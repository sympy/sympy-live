"""
This module contains SymPyLivePage,
the page object for the SymPy Live's Home page
"""
from selenium.webdriver.common.by import By


class SymPyLivePage(object):

    URL = 'http://localhost:8080'

    def __init__(self, browser):
        self.browser = browser

    def load(self):
        self.browser.get(self.URL)

    def title(self):
        return self.browser.title

    def sidebar_headings(self):
        sidebar_elements = self.browser.find_elements(By.CLASS_NAME, 'sidebar_card')
        sidebar_headings = [
            str(card.find_element(By.TAG_NAME, 'h3').text) for card in sidebar_elements
        ]
        return sidebar_headings
