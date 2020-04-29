from pages import SymPyLivePage


def test_page_title(browser):
    live_page = SymPyLivePage(browser)
    live_page.load()
    assert live_page.title() == 'SymPy Live'
