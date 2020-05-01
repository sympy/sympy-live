"""
This module contains SymPyLivePage,
the page object for the SymPy Live's Home page
"""
import time

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys


class SymPyLivePage(object):

    URL = 'http://localhost:8080'

    def __init__(self, browser):
        self.browser = browser

    def load(self):
        """Loads the URL in the given browser."""
        self.browser.get(self.URL)

    def title(self):
        """Returns the title of the page loaded by the browser."""
        return self.browser.title

    def sidebar_headings(self):
        """Returns the headings of the cards on the sidebar."""
        sidebar_elements = self.browser.find_elements(By.CLASS_NAME, 'sidebar_card')
        sidebar_headings = [
            str(card.find_element(By.TAG_NAME, 'h3').text) for card in sidebar_elements
        ]
        return sidebar_headings

    def enter_query(self, query, wait=1):
        """Enters the query in the SymPy Live's Online Shell."""
        live_input = self.browser.find_element(By.CLASS_NAME, 'sympy-live-prompt')
        live_input.send_keys(query + Keys.RETURN)
        # Wait for the query results to appear on the UI
        time.sleep(wait)

    def get_output_text(self, lines=None):
        """
        Returns the output text lines
        :param lines: returns the last n lines, by default it returns all lines
        :return: returns the list of output lines.
        """
        output = self.browser.find_element(By.CLASS_NAME, 'sympy-live-output')
        output_lines = map(str, output.text.split('\n'))
        if lines:
            return output_lines[-lines:]
        return output_lines
