from pages import SymPyLivePage


def test_page_title(browser):
    live_page = SymPyLivePage(browser)
    live_page.load()
    assert live_page.title() == 'SymPy Live'


def test_sidebar_loaded(browser):
    live_page = SymPyLivePage(browser)
    live_page.load()
    side_bar_headings = live_page.sidebar_headings()
    assert side_bar_headings == [
        'Log In',
        'About this page',
        'Example session',
        'Settings',
        'Recent Statements'
    ]


def test_input_output(browser):
    live_page = SymPyLivePage(browser)
    live_page.load()
    live_page.enter_query(query='x')
    output_text = live_page.get_output_text(lines=3)
    assert output_text == [
        '>>> x',
        'x',
        'x'
    ]
