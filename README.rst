SymPy Online Shell
==================

.. image:: https://travis-ci.org/sympy/sympy-live.svg?branch=master
    :target: https://travis-ci.org/sympy/sympy-live

Online Shell for SymPy (sympy-live) is a simple web application based on
Google App Engine, which allows to evaluate Python code with SymPy in web
browsers.

This is accomplished by providing a HTML/JavaScript GUI for entering source
code and visualization of output, and a server part which evaluates the
requested source code. Note that this shell is not scalable and it uses
only one instance on GAE, thus all evaluation requests are queued and it
may take quite a lot of time, before our code can be evaluated (depending
on the current load of the instance).

Google App Engine has intrinsic 30 second request handling limit, so each
evaluation request is a subject to this limit. There are also other limits
related to memory consumption, output size, etc. (see Google App Engine
documentation for details).

Development Server
------------------

To setup the development environment and run the app locally, you
need ``docker`` and ``docker-compose``:

* https://docs.docker.com/get-docker/
* https://docs.docker.com/compose/install/

Now you are ready to run development web server::

    $ docker-compose up

This will build and run the image for app and datastore emulator.

This will spin up a local server that runs on port ``8080``.
Open a web browser and go to http://localhost:8080.
You should see GUI of SymPy Online Shell.

Deploying to Google App Engine
------------------------------

Travis-CI is used to deploy automatically to the official server
via Github Releases.

* Go to https://github.com/sympy/sympy-live/releases
* Click on create a release and name the release as `version-NN`
where `NN` is the release version. After this travis will automatically
release version `NN`.

To upload the application manually, you need to do a few things.
First, tag th current commit with the App Engine application version
(this is not necessary unless you are deploying to the official server)::

  $ git tag -a version-42

Then install the Google Cloud SDK for your OS from here:
https://cloud.google.com/sdk/install

This will let you use the "gcloud" CLI. After this configure the CLI to access
the google cloud console for the project::

    $ gcloud init

You need to to create ``lib`` (libraries) before deploying, make sure the development
server is up and running via ``docker-compose``, as mentioned above and create
libraries folder to package with the following command::

    $ docker cp app:/usr/src/app/lib lib

Assuming that sympy-live works properly (also across different mainstream web
browsers), you can upload your changes to Google App Engine, replacing the
<TAGGED_VERSION> with actual version we tagged with::

    $ gcloud app deploy --project sympy-live-hrd --no-promote --version <TAGGED_VERSION>

This requires admin privileges to http://sympy-live.appspot.com. If you don't
have access to this App Engine application, but want to test it, see the
instructions in the `Testing on the App Engine`_ section below.

After doing either of the steps (via github release or manually),
go to http://NN.sympy-live.appspot.com, where ``NN`` is the version
you just uploaded (or released), and make sure that it works.
If it does, go to the ``Versions`` section of the sympy-live dashboard,
and set this as the new default version.  If there are any issues, you
can roll back to the previous version from this same screen.

Creating Deployment Credentials
-------------------------------

Travis-CI deploys the application using service account credentials. To create a
service account for deployment with suitable permissions, follow these steps:

https://cloud.google.com/solutions/continuous-delivery-with-travis-ci#creating_credentials

These are stored encrypted in the ``client-secret.json.enc`` file in the repository, and are generated
using the Travis command-line tools (client-secret.json is the credentials file for the service account
created int the step above) ::


  travis encrypt-file client-secret.json --add

This also adds the encrypted keys in travis environment variables, which you can
check from here: https://travis-ci.org/github/aktech/sympy-live/settings in the
"Environment Variables" section.


Testing on the App Engine
-------------------------

It's usually a good idea to test big changes on the App Engine itself before
deploying, as ``dev_appserver.py`` can only simulate the App Engine.

There is a semi-official testing server at sympy-live-tests.appspot.com. If you want
write access to it, just ask Aaron Meurer.  The convention there is to push
to the version corresponding to the pull request (so if you have a branch that
is pull request #55, you would push to version 55, and access it by
55-dot-sympy-live-tests.appspot.com).  Alternately, you can set up your own
testing server (it's free, though it requires a cell phone to set up).

You need to to create ``lib`` (libraries) before deploying, make sure the development
server is up and running via ``docker-compose``, as mentioned above and create
libraries folder to package with the following command::

    $ docker cp app:/usr/src/app/lib lib


Either way, to test, you will need to edit the Project ID in the deploy command
mentioned above with your Project ID and the version you want to deploy to::

    $ gcloud app deploy --project <your-project-name> --no-promote --version <TAGGED_VERSION>


If you have a test app online, remember to update it every time you update a
pull request, so that others can easily review your work, without even having
to use ``dev_appserver.py``.

Branch builds are automatically deployed by Travis to
`https://<BRANCH-NAME>-dot-sympy-live-hrd.appspot.com/`.
Note that branch has to be on this repository, as forks
do not have access to the key to deploy to the app engine,
and branch name should match the regex: ``[0-9a-zA-Z-_]``
(See app.yaml to check out the static files regex) for
the static files to load properly

Development notes
-----------------

Make sure SymPy Online Shell works in major mainstream web browsers. This
includes Chrome, Firefox, Safari and Internet Explorer. Be extra cautious
about trailing commas in JavaScript object and arrays. IE doesn't allow
them, so you have to remove them, if any were introduced.

Running Tests
-------------

To run tests you need to spinup the container as mentioned above
via ``docker-compose`` and run the following command::

    $ docker-compose exec app pytest tests/ -v

Pulling changes
---------------

In projects that don't use submodules, pulling changes boils down to::

    $ git pull origin master

in the simplest case. SymPy Live, however, requires additional effort::

    $ git submodule update

The above command assures that if there were any changes to submodules
of the super-project, then those submodules will get updated to new
versions. This is related to the following section.

Updating SymPy
--------------

Make sure that you followed instructions above and SymPy's submodule is
properly initialized. Assuming that you are in the directory where SymPy
Live was cloned, issue::

    $ cd sympy/
    $ git fetch origin
    $ git checkout sympy-0.7.0
    $ cd ..
    $ git add .
    $ git commit -m "Updated SymPy to version 0.7.0"

Now if you issue::

    $ git show -v

you should get::

    commit 5138e824dc9fd46c243eea2d7c9581a9e58feb08
    Author: Mateusz Paprocki <mattpap@gmail.com>
    Date:   Wed Jul 6 07:45:19 2011 +0200

        Updated SymPy to version 0.7.0

        diff --git a/sympy b/sympy
        index df7a135..c9470ac 160000
        --- a/sympy
        +++ b/sympy
        @@ -1 +1 @@
        -Subproject commit df7a135a4ff7eca361ebbb07ccbeabf8654a8d80
        +Subproject commit c9470ac4f44e7dacfb026cf74529db3ec0822145

This was done for SymPy's version 0.7.0, so in future updates of SymPy replace
0.7.0 with appropriate newer version (e.g. 0.7.1) and you are done (of course
particular SHA signatures will be different in your case). If unsure, refer to
``git help submodule`` or git book: http://book.git-scm.com/5_submodules.html.

Original info
-------------

An interactive, stateful AJAX shell that runs Python code on the server.

Part of http://code.google.com/p/google-app-engine-samples/.

May be run as a standalone app or in an existing app as an admin-only handler.
Can be used for system administration tasks, as an interactive way to try out
APIs, or as a debugging aid during development.

The logging, os, sys, db, and users modules are imported automatically.

Interpreter state is stored in the datastore so that variables, function
definitions, and other values in the global and local namespaces can be used
across commands.

To use the shell in your app, copy shell.py, static/*, and templates/* into
your app's source directory. Then, copy the URL handlers from app.yaml into
your app.yaml.
