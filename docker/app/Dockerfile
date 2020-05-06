FROM python:2-slim

RUN apt-get update \
  # dependencies for building Python packages
  && apt-get install -y build-essential \
  && apt-get install -y python-dev \
  && apt-get install -y wget \
  && apt-get install -y zip unzip

WORKDIR /usr/src/app

COPY requirements ./requirements
COPY ./docker/app/run.sh /run.sh
RUN pip install -r requirements/requirements.txt -t lib/

RUN pip install -r requirements/local_requirements.txt

# Install App engine SDK
RUN wget https://storage.googleapis.com/appengine-sdks/featured/google_appengine_1.9.90.zip -nv -P /usr/src/
RUN unzip -q /usr/src/google_appengine_1.9.90.zip -d /usr/src/
ENV SDK_LOCATION="/usr/src/google_appengine"

# Install Google Chrome for running tests
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub -P /usr/src/ | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
RUN apt-get -y update
RUN apt-get install -y google-chrome-stable

# Set display port to avoid crash
ENV DISPLAY=:99

COPY . .

# Install chromedriver
RUN wget https://chromedriver.storage.googleapis.com/81.0.4044.69/chromedriver_linux64.zip -P /usr/src/
RUN unzip -q /usr/src/chromedriver_linux64.zip -d /usr/local/bin/

ENTRYPOINT [ "/run.sh" ]
