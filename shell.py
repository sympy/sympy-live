#!/usr/bin/python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
An interactive, stateful AJAX shell that runs Python code on the server.

Part of http://code.google.com/p/google-app-engine-samples/.

May be run as a standalone app or in an existing app as an admin-only handler.
Can be used for system administration tasks, as an interactive way to try out
APIs, or as a debugging aid during development.

The logging, os, sys, db, and users modules are imported automatically.

Interpreter state is stored in the datastore so that variables, function
definitions, and other values in the global and local namespaces can be used
across commands.

To use the shell in your app, copy shell.py, static/*, and templates/* into
your app's source directory. Then, copy the URL handlers from app.yaml into
your app.yaml.

TODO: unit tests!
"""

import ast
import logging
import new
import os
import sys
import pdb
import traceback
import tokenize
import types
import json
import wsgiref.handlers
import rlcompleter
import traceback
import datetime
import contextlib
from StringIO import StringIO

from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.runtime import DeadlineExceededError
from google.appengine.runtime.apiproxy_errors import RequestTooLargeError

sys.path.insert(0, os.path.join(os.getcwd(), 'dill'))
sys.path.insert(0, os.path.join(os.getcwd(), 'sympy'))

import dill
import sympy
from sympy.core.function import UndefinedFunction
from sympy import srepr, sstr, pretty, latex
from sympy.interactive.session import int_to_Integer

@dill.register(UndefinedFunction)
def save_function(pickler, obj):
    pickler.save_reduce(sympy.Function, (repr(obj),), obj=obj)

import detectmobile
import settings

logging.getLogger('dill').setLevel(logging.ERROR)

LIVE_VERSION, LIVE_DEPLOYED = os.environ['CURRENT_VERSION_ID'].split('.')
LIVE_DEPLOYED = datetime.datetime.fromtimestamp(long(LIVE_DEPLOYED) / pow(2, 28))
LIVE_DEPLOYED = LIVE_DEPLOYED.strftime("%d/%m/%y %X")

PRINTERS = {
    'repr': srepr,
    'str': sstr,
    'ascii': lambda arg: pretty(arg, use_unicode=False, wrap_line=False),
    'unicode': lambda arg: pretty(arg, use_unicode=True, wrap_line=False),
    'latex': lambda arg: latex(arg, mode="equation*"),
}

def gdb():
    """Enter pdb in Google App Engine. """
    pdb.Pdb(stdin=getattr(sys, '__stdin__'),
            stdout=getattr(sys, '__stderr__')).set_trace(sys._getframe().f_back)

# Set to True if stack traces should be shown in the browser, etc.
_DEBUG = True

# The entity kind for shell sessions. Feel free to rename to suit your app.
_SESSION_KIND = '_Shell_Session'

# Unpicklable statements to seed new sessions with.
INITIAL_UNPICKLABLES = [
    "import logging",
    "import os",
    "import sys",
    "from google.appengine.ext import db",
    "from google.appengine.api import users",
    "from __future__ import division",
    "from sympy import *",
]

PREEXEC = """\
x, y, z, t = symbols('x y z t')
k, m, n = symbols('k m n', integer=True)
f, g, h = symbols('f g h', cls=Function)
"""

PREEXEC_INTERNAL = """\
_ = None
"""

PREEXEC_MESSAGE = """\
from __future__ import division
from sympy import *
""" + PREEXEC

VERBOSE_MESSAGE = """\
These commands were executed:
%(source)s
Documentation can be found at <a href="http://docs.sympy.org/">http://docs.sympy.org/</a>.\
"""

VERBOSE_MESSAGE_SPHINX = """\
These commands were executed:
%(source)s
"""


# The blueprint used to store user queries
class Searches(db.Model):
    user_id = db.UserProperty()
    query = db.StringProperty(multiline=True)
    timestamp = db.DateTimeProperty(auto_now_add=True)
    private = db.BooleanProperty()


def banner(quiet=False):
    from sympy import __version__ as sympy_version
    python_version = "%d.%d.%d" % sys.version_info[:3]

    message = "Python console for SymPy %s (Python %s)\n" % (sympy_version, python_version)

    if not quiet:
        source = ""

        for line in PREEXEC_MESSAGE.split('\n')[:-1]:
            if not line:
                source += '\n'
            else:
                source += '>>> ' + line + '\n'

        message += '\n' + VERBOSE_MESSAGE % {'source': source}

    return message


def banner_sphinx(quiet=False):
    from sympy import __version__ as sympy_version
    python_version = "%d.%d.%d" % sys.version_info[:3]

    message = "Python console for SymPy %s (Python %s)\n" % (sympy_version, python_version)

    if not quiet:
        source = ""

        for line in PREEXEC_MESSAGE.split('\n')[:-1]:
            if not line:
                source += '\n'
            else:
                source += '>>> ' + line + '\n'

        message += '\n' + VERBOSE_MESSAGE_SPHINX % {'source': source}

    return message


class Live(object):

    _header = 'Traceback (most recent call last):\n'
    _file = '<string>'

    def traceback(self, offset=None):
        """Return nicely formatted most recent traceback. """
        etype, value, tb = sys.exc_info()

        if tb.tb_next is not None:
            _tb = tb.tb_next
        else:
            _tb = tb

        try:
            if offset is not None:
                lines = traceback.extract_tb(_tb)

                line = lines[0][1] + offset
                lines[0] = (lines[0][0], line) + lines[0][2:]

                text = [self._header]
                text = text + traceback.format_list(lines)
                text = text + traceback.format_exception_only(etype, value)

                line = lines[0][1]
            else:
                text = traceback.format_exception(etype, value, _tb)
                line = _tb.tb_lineno
        finally:
            del tb, _tb

        return ''.join(text), line

    def syntaxerror(self):
        """Return nicely formatted syntax error. """
        etype, value, sys.last_traceback = sys.exc_info()

        sys.last_type = etype
        sys.last_value = value

        if etype is SyntaxError:
            try:
                msg, (dummy_filename, line, offset, source) = value
            except:
                pass
            else:
                value = SyntaxError(msg, (self._file, line, offset, source))
                sys.last_value = value

        text = [self._header]
        text = text + traceback.format_exception_only(etype, value)

        return ''.join(text), line

    def error(self, stream, error):
        """Write error message to a stream. """
        if stream is not None:
            stream.write(error[0])

    def split(self, source):
        """Extract last logical line from multi-line source code. """
        string = StringIO(source).readline

        try:
            tokens = list(tokenize.generate_tokens(string))
        except (OverflowError, SyntaxError, ValueError, tokenize.TokenError):
            return None, source

        for tok, _, (n, _), _, _ in reversed(tokens):
            if tok == tokenize.NEWLINE:
                lines = source.split('\n')

                exec_source = '\n'.join(lines[:n])
                eval_source = '\n'.join(lines[n:])

                return exec_source, eval_source
        else:
            return None, source

    def compile(self, source, mode):
        """Wrapper over Python's built-in function. """
        return compile(source, self._file, mode)

    @contextlib.contextmanager
    def execution_module(self, session):
        # get a dedicated module to be used as this statement's __main__
        statement_module = session.get_module()

        # use this request's __builtin__, since it changes on each request.
        # this is needed for import statements, among other things.
        import __builtin__
        statement_module.__builtin__ = __builtin__

        # swap in our custom module for __main__. then unpickle the session
        # globals, run the statement, and re-pickle the session globals, all
        # inside it.
        old_main = sys.modules.get('__main__')

        try:
            sys.modules['__main__'] = statement_module
            statement_module.__name__ = '__main__'
            session.load_session(statement_module)

            yield statement_module

            # get around pickling problems
            try:
                del statement_module.__builtins__
            except AttributeError:
                pass

            try:
                # save '_' special variable into the datastore
                statement_module._ = getattr(__builtin__, '_', None)
                session.save_session(statement_module)
            except (dill.PicklingError, RuntimeError):
                pass
        finally:
            sys.modules['__main__'] = old_main

            try:
                del __builtin__._
            except AttributeError:
                pass

    @contextlib.contextmanager
    def displayhook(self, hook):
        old_displayhook = sys.displayhook
        sys.displayhook = hook

        try:
            yield
        finally:
            sys.displayhook = old_displayhook

    def complete(self, statement, session):
        """Autocomplete the statement in the session's globals."""

        with self.execution_module(session) as statement_module:
            completer = rlcompleter.Completer(statement_module.__dict__)

            if '=' in statement:
                statement = statement.split('=', 1)[1].strip()
            # XXX need a better way to do this
            if '.' in statement:
                return completer.attr_matches(statement)
            else:
                return completer.global_matches(statement)

    def evaluate(self, statement, session, printer=None, stream=None):
        """Evaluate the statement in sessions's globals. """
        # the Python compiler doesn't like network line endings
        source = statement.replace('\r\n', '\n').rstrip()

        try:
            # check for a SyntaxError now; this way the user will see their
            # original statement and not the transformed one
            ast.parse(source)
        except SyntaxError:
            return self.error(stream, self.syntaxerror())

        # convert int to Integer (1/2 -> Integer(1)/Integer(2))
        source = int_to_Integer(source)

        # split source code into 'exec' and 'eval' parts
        exec_source, eval_source = self.split(source)

        try:
            self.compile(eval_source, 'eval')
        except (OverflowError, SyntaxError, ValueError):
            exec_source, eval_source = source, None

        if exec_source is not None:
            exec_source += '\n'
            if eval_source is not None:
                eval_source += '\n'

        # create customized display hook
        stringify_func = printer or sstr

        import __builtin__
        def displayhook(arg):
            if arg is not None:
                __builtin__._ = None
                print stringify_func(arg)
                __builtin__._ = arg

        with self.execution_module(session) as statement_module, self.displayhook(displayhook):
            # run!
            offset = 0

            try:
                old_stdout = sys.stdout
                old_stderr = sys.stderr

                try:
                    if stream is not None:
                        sys.stdout = stream
                        sys.stderr = stream

                    if exec_source is not None:
                        try:
                            exec_code = self.compile(exec_source, 'exec')
                        except (OverflowError, SyntaxError, ValueError):
                            return self.error(stream, self.syntaxerror())

                        eval(exec_code, statement_module.__dict__)

                    if eval_source is not None:
                        if exec_source is not None:
                            offset = len(exec_source.split('\n'))

                        result = eval(eval_source, statement_module.__dict__)
                        sys.displayhook(result)
                finally:
                    sys.stdout = old_stdout
                    sys.stderr = old_stderr
            except DeadlineExceededError:
                logging.debug("is deadlineexceedederror in evaluate")
                raise DeadlineExceededError
            except:
                return self.error(stream, self.traceback(offset))

        try:
            session.put()
        except RequestTooLargeError:
            stream.truncate(0) # clear output
            self.error(stream, ('Unable to process statement due to its excessive size.',))

class Session(db.Model):
    """A shell session. Stores the session's globals.

    Each session globals is stored in one of two places:

    If the global is picklable, it's stored in the parallel globals and
    global_names list properties. (They're parallel lists to work around the
    unfortunate fact that the datastore can't store dictionaries natively.)

    If the global is not picklable (e.g. modules, classes, and functions),
    or if it was created by the same statement that created an unpicklable
    global, it's not stored directly. Instead, the statement is stored in
    the unpicklables list property. On each request, before executing the
    current statement, the unpicklable statements are evaluated to recreate
    the unpicklable globals.

    The unpicklable_names property stores all of the names of globals that
    were added by unpicklable statements. When we pickle and store the
    globals after executing a statement, we skip the ones in
    unpicklable_names.

    Using Text instead of string is an optimization. We don't query on any of
    these properties, so they don't need to be indexed.
    """
    session = db.BlobProperty()

    def initialize_globals(self, live):
        for _stmt in INITIAL_UNPICKLABLES:
            live.evaluate(_stmt, self)
            live.evaluate(PREEXEC, self)
            live.evaluate(PREEXEC_INTERNAL, self)

    def get_module(self):
        if not hasattr(self, 'module'):
            self.module = new.module('__main__')
        return self.module

    def save_session(self, module):
        # We need to disable the pickling optimization here in order to get the
        # correct values out.
        self.session = db.Blob(dill.dumps_session(module))

    def load_session(self, module):
        if self.session:
            dill.loads_session(self.session, module)

class ForceDesktopCookieHandler(webapp.RequestHandler):
    def get(self):
        #Cookie stuff
        import Cookie
        import datetime

        expiration = datetime.datetime.now() + datetime.timedelta(days=1000)
        cookie = Cookie.SimpleCookie()
        cookie["desktop"] = "yes"
        #cookie["desktop"]["domain"] = "live.sympy.org"
        cookie["desktop"]["path"] = "/"
        cookie["desktop"]["expires"] = expiration.strftime("%a, %d-%b-%Y %H:%M:%S PST")
        print cookie.output()
        template_file = os.path.join(os.path.dirname(__file__), 'templates', 'redirect.html')
        vars = { 'server_software': os.environ['SERVER_SOFTWARE'],
                 'python_version': sys.version,
                 'user': users.get_current_user(),
        }
        rendered = webapp.template.render(template_file, vars, debug=_DEBUG)
        self.response.out.write(rendered)

class FrontPageHandler(webapp.RequestHandler):
    """Creates a new session and renders the ``shell.html`` template. """

    def get(self):
        #Get the 10 most recent queries
        searches_query = Searches.all().filter('private', False).order('-timestamp')
        search_results = searches_query.fetch(10)

        saved_searches = Searches.all().filter('user_id', users.get_current_user()).order('-timestamp')
        #cookie stuff
        import Cookie
        import os
        try:
            cookie = Cookie.SimpleCookie(os.environ['HTTP_COOKIE'])
            forcedesktop = cookie['desktop'].value
        except (Cookie.CookieError, KeyError):
            forcedesktop = 'false'

        if forcedesktop in ('no', 'false'):
            if detectmobile.isMobile(self.request.headers):
                self.redirect('/shellmobile?' + self.request.query_string)

        template_file = os.path.join(os.path.dirname(__file__), 'templates', 'shell.html')

        vars = {
            'server_software': os.environ['SERVER_SOFTWARE'],
            'application_version': LIVE_VERSION,
            'date_deployed': LIVE_DEPLOYED,
            'python_version': sys.version,
            'user': users.get_current_user(),
            'login_url': users.create_login_url('/'),
            'logout_url': users.create_logout_url('/'),
            'banner': banner(),
            'printer': self.request.get('printer').lower() or '',
            'submit': self.request.get('submit').lower() or '',
            'tabWidth': self.request.get('tabWidth').lower() or 'undefined',
            'searches': search_results,
            'saved_searches': saved_searches,
        }

        rendered = webapp.template.render(template_file, vars, debug=_DEBUG)
        self.response.out.write(rendered)

class CompletionHandler(webapp.RequestHandler):
    """Takes an incomplete statement and returns possible completions."""

    def _cross_site_headers(self):
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Requested-With'

    def options(self):
        self._cross_site_headers()

    def post(self):
        self._cross_site_headers()
        try:
            message = json.loads(self.request.body)
        except ValueError:
            self.error(400)
            return

        session_key = message.get('session')
        statement = message.get('statement').encode('utf-8')
        live = Live()

        if session_key is not None:
            try:
                session = Session.get(session_key)
            except db.Error:
                self.error(400)
                return
        else:
            session = Session()
            session_key = session.put()
            session.initialize_globals(live)

        completions = list(sorted(set(live.complete(statement, session))))
        if not statement.split('.')[-1].startswith('_'):
            completions = [x for x in completions if
                           not x.split('.')[-1].startswith('_')]

        # From http://stackoverflow.com/a/1916632
        # Get longest common prefix to fill instantly
        common = os.path.commonprefix(completions)

        result = {
            'session': str(session_key),
            'completions': completions,
            'prefix': common
        }

        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(result))

class EvaluateHandler(webapp.RequestHandler):
    """Evaluates a Python statement in a given session and returns the result. """

    def _cross_site_headers(self):
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Requested-With'

    def options(self):
        self._cross_site_headers()

    def post(self):
        self._cross_site_headers()

        try:
            message = json.loads(self.request.body)
        except ValueError:
            self.error(400)
            return

        # Code modified to store each query in a database
        print_statement = '\n'.join(message.get('print_statement'))
        statement = message.get('statement')
        privacy = message.get('privacy')

        if statement != '':
            searches = Searches()
            searches.user_id = users.get_current_user()
            searches.query = print_statement

        if privacy == 'off': searches.private = False
        if privacy == 'on': searches.private = True

        searches.put()

        session_key = message.get('session')
        printer_key = message.get('printer')
        live = Live()

        if session_key is not None:
            try:
                session = Session.get(session_key)
            except db.Error:
                self.error(400)
                return
        else:
            session = Session()
            session_key = session.put()
            session.initialize_globals(live)

        try:
            printer = PRINTERS[printer_key]
        except KeyError:
            printer = None

        stream = StringIO()
        try:
            live.evaluate(statement, session, printer, stream)
            result = {
                'session': str(session_key),
                'output': stream.getvalue(),
            }
        except DeadlineExceededError:
            result = {
                'session': str(session_key),
                'output': 'Error: Operation timed out.'
            }
        except Exception, e:
            if settings.DEBUG:
                errmsg = '\n'.join([
                    'Exception in SymPy Live of type ',
                    str(type(e)),
                    'for reference the stack trace is',
                    traceback.format_exc()
                ])
            else:
                errmsg = '\n'.join([
                    'Exception in SymPy Live of type ',
                    str(type(e)),
                    'for reference the last 5 stack trace entries are',
                    traceback.format_exc(5)
                ])
            result = {
                'session': str(session_key),
                'output': errmsg
            }

        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(result))

class ShellMobileFrontPageHandler(webapp.RequestHandler):
    """Creates a new session and renders the graphical_shell.html template.
    """

    def get(self):
        #Get the 10 most recent queries
        searches_query = Searches.all().filter('private', False).order('-timestamp')
        search_results = searches_query.fetch(10)
        saved_searches = Searches.all().filter('user_id', users.get_current_user()).order('-timestamp')
        template_file = os.path.join(os.path.dirname(__file__), 'templates',
                                   'shellmobile.html')
        session_url = '/shellmobile'
        vars = { 'server_software': os.environ['SERVER_SOFTWARE'],
                 'python_version': sys.version,
                 'application_version': LIVE_VERSION,
                 'date_deployed': LIVE_DEPLOYED,
                 'user': users.get_current_user(),
                 'login_url': users.create_login_url(session_url),
                 'logout_url': users.create_logout_url(session_url),
                 'tabWidth': self.request.get('tabWidth').lower() or 'undefined',
                 'searches': searches_query,
                 'saved_searches': saved_searches
        }
        rendered = webapp.template.render(template_file, vars, debug=_DEBUG)
        self.response.out.write(rendered)

class SphinxBannerHandler(webapp.RequestHandler):
    """Provides the banner for the Sphinx extension.
    """

    def _cross_site_headers(self):
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Requested-With'

    def get(self):
        self._cross_site_headers()
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write(banner_sphinx())


class DeleteHistory(webapp.RequestHandler):
    """Deletes all of the user's history"""

    def get(self):
        results = Searches.all().filter('user_id', users.get_current_user()).order('-timestamp')

        for result in results:
            db.delete(result)

        self.response.out.write("Your queries have been deleted.")

application = webapp.WSGIApplication([
    ('/', FrontPageHandler),
    ('/evaluate', EvaluateHandler),
    ('/shellmobile', ShellMobileFrontPageHandler),
    ('/shell.do', StatementHandler),
    ('/forcedesktop', ForceDesktopCookieHandler),
    ('/delete', DeleteHistory),
    ('/complete', CompletionHandler),
    ('/sphinxbanner', SphinxBannerHandler)
], debug=_DEBUG)
