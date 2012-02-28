SymPy Online Shell
==================

Online Shell for SymPy (sympy-live) is a simple web application based on
Google App Engine, which allows to evaluate Python code with SymPy in web
browsers.

This is accomplished by providing a HTML/JavaScript GUI for entering source
code and visualization of output, and a server part which evaluates the
requested source code. Note that this shell is not scalable and it uses
only one instance on GAE, thus all evaluation requests are queued and it
make take quite a lot of time, before our code can be evaluated (depending
on the current load of the instance).

Google App Engine has intrinsic 30 second request handling limit, so each
evaluation request is a subject to this limit. There are also other limits
related to memory consumption, output size, etc. (see Google App Engine
documentation for details).

Installation
------------

Download and unpack most recent Google App Engine SDK for Python from
http://code.google.com/appengine/downloads.html, e.g.::

    $ wget http://googleappengine.googlecode.com/files/google_appengine_1.5.1.zip
    $ unzip google_appengine_1.5.1.zip

On the Mac, it is a disk image with an application, which you should
drag to your Applications folder.  Open the program and install the
symlinks (it should ask you the first time you open the application, but
if it doesn't, choose "Make Symlinks..." from the
GoogleAppEngineLauncher menu).  Note that you will have to do this again
each time you update the AppEngine program.

Then clone sympy-live repository::

    $ git clone git://github.com/sympy/sympy-live.git
    $ cd sympy-live

We use submodules to include external libraries in sympy-live::

    $ git submodule init
    $ git submodule update

This is sufficient to clone appropriate repositories in correct versions
into sympy-live (see git documentation on submodules for information).

Development server
------------------

Now you are ready to run development web server::

    $ ../google_appengine/dev_appserver.py .

On the Mac, just run::

    $ dev_appserver .

(make sure you installed the symlinks as described above).

I couldn't figure out how to make it work in the GUI (it won't find the
sympy git submodule).  If you figure out how to do it, please update
this file and send a patch describing how to do it.

This is a local server that runs on port 8080 (use ``--port`` option to
change this). Open a web browser and go to http://localhost:8080. You
should see GUI of SymPy Online Shell.

Uploading to GAE
----------------

Before uploading, you need to update the version.  Edit app.yaml, and bump the
version number up by one, and commit this change.  Then, go to
https://appengine.google.com/deployment?app_id=sympy-live and delete the
oldest version (we can only have ten versions at once, so if you don't do
this, it will reject the upload).  Then, you can upload the new version.

Assuming that sympy-live works properly (also across different mainstream
web browsers), you can upload your changes to Google App Engine::

    $ ../appcfg.py update .

Or, in Mac OS X, just open the GoogleAppEngineLauncher program, add the
project if you haven't already, and click "Deploy" in the toolbar.  And
then it should just work (follow the log that comes up to see.

This requires admin privileges to http://sympy-live.appspot.com. If you
don't have access to this App Engine application, you can make your own.
To achieve this, create an account on Google App Engine, start a new
application and make appropriate changes to ``app.yaml`` (replace in the
first line sympy-live with the name of your application). Then you can
use ``appcfg.py`` as above, to upload to GAE.

Go to http://<new-version-number>.sympy-live.appspot.com (for example, for
version 21, go to http://21.sympy-live.appspot.com/) after uploading and make
sure that everything works.  If it does, go to
https://appengine.google.com/deployment?app_id=sympy-live and set the newest
version to the default.

Changing the version before each upload makes it easy to rollback accidental
regressions.  Just go to the dashboard and revert to the latest version that
doesn't have the problem.  This also lets you test the latest version after
uploading before deploying it to the main site.

Do not use versions to upload tests.  If you want to test something, create a
separate test app on the App Engine and upload it there.

Development notes
-----------------

Make sure SymPy Online Shell works in major mainstream web browsers. This
includes Chrome, Firefox, Safari and Internet Explorer. Be extra cautious
about trailing commas in JavaScript object and arrays. IE doesn't allow
them, so you have to remove them, if any were introduced.

GAE development server allows to use any Python interpreter, but Google
App Engine uses Python 2.5, so if the default Python isn't 2.5, then make
sure to test your changes to the server part, if it runs properly on 2.5.
Also don't use any modules that aren't supported by GAE.

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
