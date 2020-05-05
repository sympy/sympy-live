from google.appengine.ext import webapp
from app.shell import (
    FrontPageHandler,
    EvaluateHandler,
    ForceDesktopCookieHandler,
    DeleteHistory,
    CompletionHandler,
    SphinxBannerHandler,
    RedirectHandler,
    StatusHandler,
    _DEBUG
)

application = webapp.WSGIApplication([
    ('/', FrontPageHandler),
    ('/evaluate', EvaluateHandler),
    ('/forcedesktop', ForceDesktopCookieHandler),
    ('/delete', DeleteHistory),
    ('/complete', CompletionHandler),
    ('/sphinxbanner', SphinxBannerHandler),
    ('/shellmobile', RedirectHandler),
    ('/shelldsi', RedirectHandler),
    ('/helpdsi', RedirectHandler),
    ('/status', StatusHandler),
], debug=_DEBUG)
