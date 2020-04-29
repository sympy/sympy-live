"""
This module contains SymPyLivePage,
the page object for the SymPy Live's Home page
"""


class SymPyLivePage(object):

    URL = 'http://localhost:8080'

    def __init__(self, browser):
        self.browser = browser

    def load(self):
        self.browser.get(self.URL)

    def title(self):
        return self.browser.title
