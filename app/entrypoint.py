import six
# https://github.com/googleapis/python-ndb/issues/249#issuecomment-560957294
six.moves.reload_module(six)

from google.appengine.ext import webapp
from app import handlers


application = webapp.WSGIApplication([
    ('/', handlers.FrontPageHandler),
    ('/evaluate', handlers.EvaluateHandler),
    ('/forcedesktop', handlers.ForceDesktopCookieHandler),
    ('/delete', handlers.DeleteHistory),
    ('/complete', handlers.CompletionHandler),
    ('/sphinxbanner', handlers.SphinxBannerHandler),
    ('/shellmobile', handlers.RedirectHandler),
    ('/shelldsi', handlers.RedirectHandler),
    ('/helpdsi', handlers.RedirectHandler),
    ('/status', handlers.StatusHandler),
], debug=handlers._DEBUG)
