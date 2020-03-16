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
import types
import os
import pickle
import sys
import pdb
import traceback
import tokenize
import json
import datetime
import wsgiref.handlers
from io import StringIO, BytesIO
from json import JSONEncoder
from base64 import b64encode, b64decode
from django.shortcuts import render
from django.http import HttpResponseRedirect, HttpResponse, HttpResponseBadRequest, JsonResponse
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.sessions.backends.db import SessionStore
from django.views import View
from inspect import currentframe, getframeinfo
# from IPython.terminal.embed import InteractiveShellEmbed
from typing import Dict, Union

import numpy

from sympy_live.settings import BASE_DIR, DEBUG
from . import rlcompleter
from .models import Searches, User

sys.path.insert(0, os.path.join(os.getcwd(), 'sympy'))
sys.path.insert(0, os.path.join(os.getcwd(), 'mpmath'))

from sympy import srepr, sstr, pretty, latex, __version__ as sympy_version
from sympy.interactive.session import int_to_Integer

# import settings

# LIVE_VERSION = os.environ['GAE_VERSION']
# LIVE_DEPLOYED = LIVE_VERSION[6:8] + '/' + LIVE_VERSION[4:6] + '/' + LIVE_VERSION[0:4] + ' ' + LIVE_VERSION[9:11]
# LIVE_VERSION, LIVE_DEPLOYED = os.environ['CURRENT_VERSION_ID'].split('.')
v = '58.423596622806301043'
LIVE_VERSION, LIVE_DEPLOYED = v.split('.')
LIVE_DEPLOYED = datetime.datetime.fromtimestamp(int(LIVE_DEPLOYED) / pow(2, 28))
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
# _SESSION_KIND = '_Shell_Session'

# Types that can't be pickled.
UNPICKLABLE_TYPES = (
    types.ModuleType,
    type(list),
    types.FunctionType,
)

# Unpicklable statements to seed new sessions with.
INITIAL_UNPICKLABLES = [
    "import logging",
    "import os",
    "import sys",
    "from sympy import *",
]

PREEXEC = """\
x, y, z, t = symbols('x y z t')
k, m, n = symbols('k m n', integer=True)
f, g, h = symbols('f g h', cls=Function)
"""

PREEXEC_INTERNAL = """\
_ = None
def init_printing(*args, **kwargs):
    print("To change the printing method of SymPy Live, use the settings" + \
          " in the menu to the right (below on mobile).")
"""

PREEXEC_MESSAGE = """\
from sympy import *
""" + PREEXEC

VERBOSE_MESSAGE = """\
These commands were executed:
%(source)s
Warning: this shell runs with SymPy %(version)s and so examples pulled from
other documentation may provide unexpected results.
Documentation can be found at <a href="http://docs.sympy.org/%(version)s">http://docs.sympy.org/%(version)s</a>.\
"""

VERBOSE_MESSAGE_SPHINX = """\
These commands were executed:
%(source)s
"""


class DeadlineExceededError(Exception):
    pass


def banner(quiet=False):
    python_version = "%d.%d.%d" % sys.version_info[:3]

    message = "Python console for SymPy %s (Python %s)\n" % (sympy_version, python_version)

    if not quiet:
        source = ""

        for line in PREEXEC_MESSAGE.split('\n')[:-1]:
            if not line:
                source += '\n'
            else:
                source += '>>> ' + line + '\n'

        docs_version = sympy_version
        if 'git' in sympy_version or '.rc' in sympy_version:
            docs_version = 'dev'

        message += '\n' + VERBOSE_MESSAGE % {
            'source': source,
            'version': docs_version
        }

    return message


def banner_sphinx(quiet=False):
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


def set_global(session, name, value):
    """Adds a global, or updates it if it already exists.

    Also removes the global from the list of unpicklable names.

    Args:
      name: the name of the global to remove
      value: any picklable value
      session: session of the user
    """
    # We need to disable the pickling optimization here in order to get the
    # correct values out.

    # blob = b64encode(fast_dumps(value, 1)).decode('utf-8')
    blob = b64encode(pickle.dumps(value, 1)).decode('utf-8')

    if name in session['global_names']:
        index = session['global_names'].index(name)
        session['globals'][index] = blob
        # session['globals'][name] = blob
    else:
        session['global_names'].append(name)
        session['globals'].append(blob)

    remove_unpicklable_name(session, name)
    session.modified = True


def remove_global(session, name):
    """Removes a global, if it exists.

    Args:
      name: string, the name of the global to remove
    """
    if name in session['global_names']:
        index = session['global_names'].index(name)
        del session['global_names'][index]
        del session['globals'][index]

    session.modified = True


def globals_dict(session):
    """Returns a dictionary view of the globals.
    """
    return dict((name, pickle.loads(b64decode(val.encode('utf-8'))))
    # return dict((name, val)
                for name, val in zip(session['global_names'], session['globals']))


def add_unpicklable(session, statement, names):
    """Adds a statement and list of names to the unpicklables.

    Also removes the names from the globals.

    Args:
      statement: string, the statement that created new unpicklable global(s).
      names: list of strings; the names of the globals created by the statement.
    """
    if statement not in session['unpicklables']:
        session['unpicklables'].append(statement)

    for name in names:
        remove_global(session, name)
        if name not in session['unpicklable_names']:
            session['unpicklable_names'].append(name)

    session.modified = True


def remove_unpicklable_name(session, name):
    """Removes a name from the list of unpicklable names, if it exists.

    Args:
      name: string, the name of the unpicklable global to remove
    """
    if name in session['unpicklable_names']:
        session['unpicklable_names'].remove(name)

    session.modified = True


def fast_dumps(obj, protocol=None):
    """Performs the same function as pickle.dumps but with optimizations off.

    Args:
      obj: object, object to be pickled
      protocol: int, optional protocol option to emulate pickle.dumps

    Note: It is necessary to pickle SymPy values with the fast option in order
          to get the correct assumptions when unpickling. See Issue 2587.
    """
    file = BytesIO()
    # file = StringIO()
    p = pickle.Pickler(file, protocol)
    p.fast = 1
    p.dump(obj)
    return file.getvalue()


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

        # extract info from error value (specifcally, we want the line number)
        line = 'line'
        try:
            msg, (dummy_filename, line, offset, source) = value
        except:
            pass
        else:
            # re-package error with `self._file` instead of `dummy_filename`
            value = etype(msg, (self._file, line, offset, source))
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

        lines = source.split('\n')
        n = len(lines)
        if n > 1:
            if lines[n-1][0] != ' ' or lines[n-1][0] != '\t':
                return source, (lines[n-1])
            else:
                return source, None
        else:
            return source, source

        # try:
        #     tokens = list(tokenize.generate_tokens(string))
        # except (OverflowError, SyntaxError, ValueError, tokenize.TokenError):
        #     return None, source

        # for tok, _, (n, _), _, _ in reversed(tokens):
        #     if tok == tokenize.NEWLINE:
        #         lines = source.split('\n')

        #         exec_source = '\n'.join(lines[:n])
        #         eval_source = '\n'.join(lines[n:])

        #         return exec_source, eval_source
        # else:
        #     return None, source

    def compile(self, source, mode):
        """Wrapper over Python's built-in function. """
        return compile(source, self._file, mode)

    def complete(self, statement, session):
        # def complete(self, statement):
        """Autocomplete the statement in the session's globals."""

        statement_module = types.ModuleType('__main__')
        # import builtins
        # statement_module.__builtin__ = __builtins__
        statement_module.__builtins__ = __builtins__

        old_main = sys.modules.get('__main__')

        try:
            sys.modules['__main__'] = statement_module

            statement_module.__name__ = '__main__'

            # re-evaluate the unpicklables
            for code in session['unpicklables']:
                exec(code, statement_module.__dict__)

            old_globals = dict(statement_module.__dict__)

            # re-initialize the globals
            session_globals_dict = globals_dict(session)

            for name, val in list(session_globals_dict.items()):
                try:
                    statement_module.__dict__[name] = val
                except:
                    remove_global(session, name)

            __builtins__['_'] = session_globals_dict.get('_')

            completer = rlcompleter.Completer(statement_module.__dict__)

            if '=' in statement:
                statement = statement.split('=', 1)[1].strip()
            # XXX need a better way to do this
            if '.' in statement:
                return completer.attr_matches(statement)
            else:
                return completer.global_matches(statement)

        finally:
            sys.modules['__main__'] = old_main
            try:
                del __builtins__['_']
            except AttributeError:
                pass

    def evaluate(self, statement, session, printer=None, stream=None):
        # def evaluate(self, statement, printer=None, stream=None):
        """Evaluate the statement in sessions's globals. """
        # the Python compiler doesn't like network line endings
        source = statement.replace('\r\n', '\n').rstrip()

        # allow spaces before one-liners (to emulate Python shell's behaviour)
        if '\n' not in source:
            source = source.lstrip()

        try:
            # check for a SyntaxError now; this way the user will see their
            # original statement and not the transformed one
            ast.parse(source)
        except SyntaxError:
            return self.error(stream, self.syntaxerror())

        # convert int to Integer (1/2 -> Integer(1)/Integer(2))
        source = int_to_Integer(source)
        # print(getframeinfo(currentframe()).lineno, source)

        # split source code into 'exec' and 'eval' parts
        exec_source, eval_source = self.split(source)
        # print(getframeinfo(currentframe()).lineno, exec_source, eval_source)

        try:
            self.compile(eval_source, 'eval')
        except (OverflowError, SyntaxError, ValueError):
            exec_source, eval_source = source, None
        # print(getframeinfo(currentframe()).lineno, exec_source, eval_source)

        if exec_source is not None:
            exec_source += '\n'
        if eval_source is not None:
            eval_source += '\n'

        # create a dedicated module to be used as this statement's __main__
        statement_module = types.ModuleType('__main__')

        # use this request's __builtin__, since it changes on each request.
        # this is needed for import statements, among other things.
        # import builtins
        statement_module.__builtins__ = __builtins__

        # create customized display hook
        stringify_func = printer or sstr

        def displayhook(arg):
            if arg is not None:
                __builtins__['_'] = None
                print(stringify_func(arg))
                __builtins__['_'] = arg

        old_displayhook = sys.displayhook
        sys.displayhook = displayhook

        # swap in our custom module for __main__. then unpickle the session
        # globals, run the statement, and re-pickle the session globals, all
        # inside it.
        old_main = sys.modules.get('__main__')

        try:
            old_globals = {}
            sys.modules['__main__'] = statement_module
            statement_module.__name__ = '__main__'

            # re-evaluate the unpicklables
            for code in session['unpicklables']: ##
                exec(code, statement_module.__dict__)
                exec(code, old_globals)

            # re-initialize the globals
            session_globals_dict = globals_dict(session)

            for name, val in list(session_globals_dict.items()):
                try:
                    statement_module.__dict__[name] = val
                    old_globals[name] = val
                except:
                    remove_global(session, name)

            # re-initialize '_' special variable
            __builtins__['_'] = session_globals_dict.get('_')
            # print(getframeinfo(currentframe()).lineno, __builtins__['_'])

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

                    # print('PR eval', eval_source, exec_source)
                    # if '=' not in exec_source and 'print' not in exec_source and 'import' not in exec_source:
                    # eval_source = exec_source
                    if eval_source is not None and 'print' not in eval_source:
                        if exec_source is not None:
                            offset = len(exec_source.split('\n'))

                        try:
                            result = eval(eval_source, statement_module.__dict__)
                            sys.displayhook(result)
                        except:
                            pass
                finally:
                    sys.stdout = old_stdout
                    sys.stderr = old_stderr
            # except DeadlineExceededError:
            #     logging.debug("is deadlineexceedederror in evaluate")
            #     raise DeadlineExceededError
            except:
                return self.error(stream, self.traceback(offset))

            # extract the new globals that this statement added
            new_globals = {}

            for name, val in list(statement_module.__dict__.items()):
                if name not in old_globals or val != old_globals[name]:
                    new_globals[name] = val

            for name in old_globals:
                if name not in statement_module.__dict__:
                    remove_global(session, name)

            if True in [isinstance(val, UNPICKLABLE_TYPES) for val in list(new_globals.values())]:
                # this statement added an unpicklable global. store the statement and
                # the names of all of the globals it added in the unpicklables
                source = ""

                if exec_source:
                    source += exec_source
                if eval_source:
                    source += eval_source

                source += "\n"

                add_unpicklable(session, source, list(new_globals.keys()))
                logging.debug('Storing this statement as an unpicklable.')
            else:
                # this statement didn't add any unpicklables. pickle and store the
                # new globals back into the datastore
                for name, val in list(new_globals.items()):
                    if not name.startswith('__'):
                        try:
                            set_global(session, name, val)
                        except (TypeError, pickle.PicklingError):
                            pass

            # save '_' special variable into the datastore
            val = __builtins__['_']
            # print(getframeinfo(currentframe()).lineno, 'val', val)

            try:
                set_global(session, '_', val)
            except (TypeError, pickle.PicklingError):
                set_global(session, '_', None)
        finally:
            sys.modules['__main__'] = old_main
            sys.displayhook = old_displayhook

            try:
                del __builtins__['_']
            except AttributeError:
                pass

        try:
            # session.put()
            session.modified = True
        # except RequestTooLargeError:
        except:
            stream.truncate(0)  # clear output
            self.error(stream, ('Unable to process statement due to its excessive size.',))


def force_desktop_cookie(request):
    import http.cookies
    import datetime

    expiration = datetime.datetime.now() + datetime.timedelta(days=1000)
    cookie = http.cookies.SimpleCookie()
    cookie["desktop"] = "yes"
    # cookie["desktop"]["domain"] = "live.sympy.org"
    cookie["desktop"]["path"] = "/"
    cookie["desktop"]["expires"] = expiration.strftime("%a, %d-%b-%Y %H:%M:%S PST")
    print(cookie.output())
    # template_file = os.path.join(os.path.dirname(__file__), 'templates', 'redirect.html')
    context = {'server_software': os.environ['SERVER_SOFTWARE'],
               'python_version': sys.version,
               'user': request.user,
               }
    return render(request, 'redirect.html', context)


@csrf_exempt
# @login_required(login_url='/admin/login/?next=/')
def index(request):
    searches_query = Searches.objects.filter(private=False).order_by('timestamp')
    search_results = searches_query.reverse()[:10]
    # ipshell = InteractiveShellEmbed(banner1='banner', exit_msg='exit_msg')
    if request.user.is_authenticated:
        saved_searches = Searches.objects.filter(user_id=request.user)
    else:
        saved_searches = Searches.objects.none()

    try:
        printer = request.GET['printer']
    except:
        printer = ''

    try:
        submit = request.GET['submit']
    except:
        submit = ''

    context = {
        # 'server_software': os.environ['SERVER_SOFTWARE'],
        'application_version': LIVE_VERSION,
        'date_deployed': LIVE_DEPLOYED,
        'python_version': sys.version,
        'user': request.user,
        'login_url': '/admin/login/?next=/',
        'logout_url': '/admin/logout/?next=/',
        'banner': banner(),
        'printer': printer,
        'submit': submit,
        'tabWidth': 'undefined',
        'searches': search_results,
        'has_searches': bool(search_results),
        'saved_searches': saved_searches,
        'has_saved_searches': saved_searches.count()
    }

    return render(request, 'shell.html', context)


@csrf_exempt
def complete(request):
    """Takes an incomplete statement and returns possible completions."""

    # self.response.headers['Access-Control-Allow-Origin'] = '*'
    # self.response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Requested-With'
    try:
        message = json.loads(request.body)
    except ValueError:
        # self.error(400)
        return

    session = request.session
    session_key = request.session.session_key
    # statement = message.get('statement').encode('utf-8')
    statement = message.get('statement')
    live = Live()
    session['unpicklables'] = list(INITIAL_UNPICKLABLES)
    session.save()
    live.evaluate(PREEXEC, session)
    live.evaluate(PREEXEC_INTERNAL, session)

    completions = list(sorted(set(live.complete(statement, session))))
    if not statement.split('.')[-1].startswith('_'):
        completions = [x for x in completions if
                       not x.split('.')[-1].startswith('_')]

    common = os.path.commonprefix(completions)

    result = {
        'session': str(session_key),
        'completions': completions,
        'prefix': common
    }

    response = JsonResponse(result)
    return response


@csrf_exempt
def evaluate(request):
    """Evaluates a Python statement in a given session and returns the result. """

    # def _cross_site_headers(self):
    #     self.response.headers['Access-Control-Allow-Origin'] = '*'
    #     self.response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Requested-With'
    #
    # def options(self):
    #     self._cross_site_headers()

    # def post(self, request):
    #     self._cross_site_headers()
    # print(getframeinfo(currentframe()).lineno, request.body)
    try:
        message = json.loads(request.body)
        # print(getframeinfo(currentframe()).lineno, message)
    except ValueError:
        # error(400)
        print(400)
        return HttpResponseBadRequest

    # Code modified to store each query in a database
    print_statement = '\n'.join(message.get('print_statement'))
    statement = message.get('statement')
    privacy = message.get('privacy')
    session_key = message.get('session')

    # print(getframeinfo(currentframe()).lineno, request.user, request.session.session_key)
    if not request.user.is_authenticated:
        request.user = User.objects.get(username='anonymous')
        # if request.session.session_key is None:
        if session_key is not None:
            session = SessionStore(session_key=session_key)
        else:
            session = SessionStore()
            session.create()
        request.session = session
        session.modified = True
        session.save()
    elif session_key is None:
        session = SessionStore()
        session.create()
        request.session = session
        session.modified = True
        session.save()
    # print(getframeinfo(currentframe()).lineno, request.user, request.session.session_key)
    user = request.user

    if statement != '':

        if privacy == 'off':
            searches = Searches.objects.create(user_id=user, query=print_statement, private=False)

        if privacy == 'on':
            searches = Searches.objects.create(user_id=user, query=print_statement, private=True)

    searches.save()

    session_key = request.session.session_key
    printer_key = message.get('printer')
    live = Live()
    session = request.session
    session.set_expiry(6000)
    if not 'unpicklables' in session:
        session['unpicklables'] = [line for line in INITIAL_UNPICKLABLES]
    if not 'global_names' in session:
        session['global_names'] = []
    if not 'globals' in session:
        session['globals'] = []
    if not 'unpicklable_names' in session:
        session['unpicklable_names'] = []

    # session.modified = True
    session.save()
    live.evaluate(PREEXEC, session)
    live.evaluate(PREEXEC_INTERNAL, session)

    try:
        printer = PRINTERS[printer_key]
    except KeyError:
        printer = None

    stream = StringIO()
    try:
        live.evaluate(statement, session, printer, stream)
        result = {
            'session': str(session_key),
            'output': str(stream.getvalue()),
        }
    except DeadlineExceededError:
        result = {
            'session': str(session_key),
            'output': 'Error: Operation timed out.'
        }
    except Exception as e:
        if DEBUG:
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
            'output': str(errmsg)
        }

    response = JsonResponse(result)
    return response


def sphinxbanner(request):
    response = HttpResponse(content_type='text/plain')
    print(banner_sphinx())
    response.write(banner_sphinx())
    return response


def delete(request):
    Searches.objects.filter(user_id=request.user).delete()
    request.session.clear()
    return HttpResponse("Your queries have been deleted.")


def redirect(request):
    return HttpResponseRedirect('/')
