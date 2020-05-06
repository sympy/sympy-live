FROM python:2-slim

RUN apt-get update \
  # dependencies for building Python packages
  && apt-get install -y build-essential \
  && apt-get install -y python-dev \
  && apt-get install -y wget \
  && apt-get install -y zip unzip

WORKDIR /usr/src/app

COPY requirements ./requirements
COPY ./docker/app/run.sh ./run.sh
RUN pip install -r requirements/requirements.txt -t lib/
RUN pip install -r requirements/local_requirements.txt

# Install App engine SDK
RUN wget https://storage.googleapis.com/appengine-sdks/featured/google_appengine_1.9.90.zip -nv -P /usr/src/
RUN unzip -q /usr/src/google_appengine_1.9.90.zip -d /usr/src/
ENV SDK_LOCATION="/usr/src/google_appengine"

# Install chromedriver
RUN wget https://chromedriver.storage.googleapis.com/81.0.4044.69/chromedriver_linux64.zip
RUN unzip -q chromedriver_linux64.zip
RUN cp chromedriver /usr/local/bin/

COPY . .

ENTRYPOINT [ "./run.sh" ]
