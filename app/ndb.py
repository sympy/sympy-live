import os

from google.cloud import ndb

ndb_client = ndb.Client(project=os.environ['PROJECT_ID'])
