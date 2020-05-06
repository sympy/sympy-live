"""
This module contains shared fixtures.
"""

import json
import pytest
import selenium.webdriver

CONFIG_PATH = 'tests/config.json'
SUPPORTED_BROWSERS = ['Firefox', 'Chrome', 'Headless Chrome']


@pytest.fixture
def config(scope='session'):

    # Read the file
    with open(CONFIG_PATH) as config_file:
        config = json.load(config_file)

    # Assert values are acceptable
    assert config['browser'] in SUPPORTED_BROWSERS
    assert isinstance(config['implicit_wait'], int)
    assert config['implicit_wait'] > 0

    # Return config so it can be used
    return config


@pytest.fixture
def browser(config):

    # Initialize the WebDriver instance
    if config['browser'] == 'Firefox':
        b = selenium.webdriver.Firefox()
    elif config['browser'] == 'Chrome':
        b = selenium.webdriver.Chrome()
    elif config['browser'] == 'Headless Chrome':
        opts = selenium.webdriver.ChromeOptions()
        opts.add_argument('headless')
        opts.add_argument('--no-sandbox')
        opts.add_argument('--window-size=1420,1080')
        opts.add_argument('--disable-gpu')

        b = selenium.webdriver.Chrome(options=opts)
    else:
        raise Exception('Browser "%s" is not supported' % config["browser"])

    # Make its calls wait for elements to appear
    b.implicitly_wait(config['implicit_wait'])

    # Return the WebDriver instance for the setup
    yield b

    # Quit the WebDriver instance for the cleanup
    b.quit()
