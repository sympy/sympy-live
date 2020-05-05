import json
import os
import datetime
import sys
import traceback

from StringIO import StringIO

from google.appengine.ext.webapp import template
from google.appengine.ext import webapp
from google.appengine.api import users

from google.appengine.runtime import DeadlineExceededError

from google.cloud import ndb

from .models import Session, Searches
from .ndb import ndb_client
from .shell import Live

import settings

from app.constants import (
    INITIAL_UNPICKLABLES,
    PREEXEC,
    PREEXEC_INTERNAL,
    PREEXEC_MESSAGE,
    VERBOSE_MESSAGE,
    VERBOSE_MESSAGE_SPHINX,
    PRINTERS
)


LIVE_VERSION, LIVE_DEPLOYED = os.environ['CURRENT_VERSION_ID'].split('.')
LIVE_DEPLOYED = datetime.datetime.fromtimestamp(long(LIVE_DEPLOYED) / pow(2, 28))
LIVE_DEPLOYED = LIVE_DEPLOYED.strftime("%d/%m/%y %X")
_DEBUG = True


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

        docs_version = sympy_version
        if 'git' in sympy_version or '.rc' in sympy_version:
            docs_version = 'dev'

        message += '\n' + VERBOSE_MESSAGE % {
            'source': source,
            'version': docs_version
        }

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
        cookie["desktop"]["expires"] = \
            expiration.strftime("%a, %d-%b-%Y %H:%M:%S PST")
        print cookie.output()
        template_file = os.path.join(os.path.dirname(__file__), '../templates', 'redirect.html')
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
        with ndb_client.context():
            searches_query = Searches.query_(Searches.private == False).order(-Searches.timestamp)
            search_results = [result.query for result in searches_query.fetch(10)]
            user = users.get_current_user()
            if user:
                _saved_searches = Searches.query_(Searches.user_id == user.user_id()).order(-Searches.timestamp).fetch()
                saved_searches = [search.query for search in _saved_searches]
            else:
                saved_searches = []
            saved_searches_count = len(saved_searches)
        template_file = os.path.join(os.path.dirname(__file__), '../templates', 'shell.html')

        vars = {
            'server_software': os.environ['SERVER_SOFTWARE'],
            'application_version': LIVE_VERSION,
            'current_year': datetime.datetime.utcnow().year,
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
            'has_searches': bool(search_results),
            'saved_searches': saved_searches,
            'has_saved_searches': saved_searches_count
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
                with ndb_client.context():
                    session = ndb.Key(urlsafe=session_key).get()
            except ndb.exceptions.Error:
                self.error(400)
                return
        else:
            with ndb_client.context():
                session = Session()
                session.unpicklables = [line for line in INITIAL_UNPICKLABLES]
                session_key = session.put().urlsafe()

            live.evaluate(PREEXEC, session)
            live.evaluate(PREEXEC_INTERNAL, session)

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

        with ndb_client.context():
            if statement != '':
                user = users.get_current_user()

                searches = Searches()
                searches.user_id = user.user_id() if user else None
                searches.query = print_statement

            if privacy == 'off': searches.private = False
            if privacy == 'on': searches.private = True

            searches.put()

        session_key = message.get('session')
        printer_key = message.get('printer')
        live = Live()

        if session_key is not None:
            try:
                with ndb_client.context():
                    session = ndb.Key(urlsafe=session_key).get()
            except ndb.exceptions.Error:
                self.error(400)
                return
        else:
            with ndb_client.context():
                session = Session()
                session.unpicklables = [line for line in INITIAL_UNPICKLABLES]
                session_key = session.put().urlsafe()

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
        with ndb_client.context():
            user = users.get_current_user()
            results = Searches.query_(Searches.user_id == user.user_id()).order(-Searches.timestamp)

            for result in results:
                result.key.delete()

        self.response.out.write("Your queries have been deleted.")


class RedirectHandler(webapp.RedirectHandler):
    """Redirects deprecated pages to the frontpage."""

    def get(self):
        self.redirect('/', permanent=True)


class StatusHandler(webapp.RequestHandler):
    """Status endpoint to check if the app is running or not."""

    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps({"status": "ok"}))
