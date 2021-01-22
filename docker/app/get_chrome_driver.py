"""Downloads the Chrome driver based on the chrome version

This is based on the innstructions from Google:
https://chromedriver.chromium.org/downloads/version-selection

"""
import subprocess
import urllib2
import wget
import sys

CHROME_DRIVER_VERSION_URL = "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_"
CHROME_DRIVER_DOWNLOAD_URL = "https://chromedriver.storage.googleapis.com/%s/chromedriver_linux64.zip"


def get_chrome_version():
    print "Getting Chrome Version"
    google_chrome_version = subprocess.check_output(
        ["google-chrome-stable", "--product-version"]
    )
    chrome_version = google_chrome_version.rsplit('.', 1)[0]
    print "Chrome Version: %s" % chrome_version
    return chrome_version


def get_chrome_driver_version():
    chrome_version = get_chrome_version()
    url = "%s%s" % (CHROME_DRIVER_VERSION_URL, chrome_version)
    print "Getting Chrome Driver Version from url: %s" % url
    chromedriver_version = urllib2.urlopen(url).read()
    print "Chrome Driver Version: %s" % chromedriver_version
    return chromedriver_version


def download_chrome_driver(path):
    chrome_driver_version = get_chrome_driver_version()
    print "Downloading Chrome Driver: %s" % chrome_driver_version
    download_url = CHROME_DRIVER_DOWNLOAD_URL % chrome_driver_version
    print "Download url: %s" % download_url
    wget.download(download_url, path)


if __name__ == '__main__':
    download_path = sys.argv[1]
    download_chrome_driver(download_path)
