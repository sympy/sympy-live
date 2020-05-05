import os
import sys

sys.path.insert(0, os.path.join(os.getcwd(), 'sympy'))
sys.path.insert(0, os.path.join(os.getcwd(), 'mpmath'))

from sympy import srepr, sstr, pretty, latex
import types

# Types that can't be pickled.
UNPICKLABLE_TYPES = (
  types.ModuleType,
  types.TypeType,
  types.ClassType,
  types.FunctionType,
  )

# Unpicklable statements to seed new sessions with.
INITIAL_UNPICKLABLES = [
  "import logging",
  "import os",
  "import sys",
  "from google.cloud import ndb",
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
def init_printing(*args, **kwargs):
    print "To change the printing method of SymPy Live, use the settings" + \
          " in the menu to the right (below on mobile)."
"""

PREEXEC_MESSAGE = """\
from __future__ import division
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

PRINTERS = {
    'repr': srepr,
    'str': sstr,
    'ascii': lambda arg: pretty(arg, use_unicode=False, wrap_line=False),
    'unicode': lambda arg: pretty(arg, use_unicode=True, wrap_line=False),
    'latex': lambda arg: latex(arg, mode="equation*"),
}
