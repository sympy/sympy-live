import pickle
from StringIO import StringIO

from google.cloud import ndb


class Searches(ndb.Model):
    """The blueprint used to store user queries."""
    user_id = ndb.StringProperty()
    query = ndb.StringProperty()
    timestamp = ndb.DateTimeProperty(auto_now_add=True)
    private = ndb.BooleanProperty()

    @classmethod
    def query_(cls, *args, **kwargs):
        """This method is for backwards compatibility, the ndb.Model now have a query
        method, which conflicts with the query StringProperty of Searches.
        """
        return super(Searches, cls).query(*args, **kwargs)


class Session(ndb.Model):
    """A shell session. Stores the session's globals.

    Each session globals is stored in one of two places:

    If the global is picklable, it's stored in the parallel globals and
    global_names list properties. (They're parallel lists to work around the
    unfortunate fact that the datastore can't store dictionaries natively.)

    If the global is not picklable (e.g. modules, classes, and functions), or if
    it was created by the same statement that created an unpicklable global,
    it's not stored directly. Instead, the statement is stored in the
    unpicklables list property. On each request, before executing the current
    statement, the unpicklable statements are evaluated to recreate the
    unpicklable globals.

    The unpicklable_names property stores all of the names of globals that were
    added by unpicklable statements. When we pickle and store the globals after
    executing a statement, we skip the ones in unpicklable_names.

    Using Text instead of string is an optimization. We don't query on any of
    these properties, so they don't need to be indexed.
    """
    global_names = ndb.TextProperty(repeated=True)
    globals = ndb.BlobProperty(repeated=True)
    unpicklable_names = ndb.TextProperty(repeated=True)
    unpicklables = ndb.TextProperty(repeated=True)

    def set_global(self, name, value):
        """Adds a global, or updates it if it already exists.

        Also removes the global from the list of unpicklable names.

        Args:
          name: the name of the global to remove
          value: any picklable value
        """
        # We need to disable the pickling optimization here in order to get the
        # correct values out.
        blob = self.fast_dumps(value, 1)

        if name in self.global_names:
            index = self.global_names.index(name)
            self.globals[index] = blob
        else:
            self.global_names.append(name)
            self.globals.append(blob)

        self.remove_unpicklable_name(name)

    def remove_global(self, name):
        """Removes a global, if it exists.

        Args:
          name: string, the name of the global to remove
        """
        if name in self.global_names:
            index = self.global_names.index(name)
            del self.global_names[index]
            del self.globals[index]

    def globals_dict(self):
        """Returns a dictionary view of the globals.
        """
        return dict((name, pickle.loads(val))
                    for name, val in zip(self.global_names, self.globals))

    def add_unpicklable(self, statement, names):
        """Adds a statement and list of names to the unpicklables.

        Also removes the names from the globals.

        Args:
          statement: string, the statement that created new unpicklable global(s).
          names: list of strings; the names of the globals created by the statement.
        """
        self.unpicklables.append(statement)

        for name in names:
            self.remove_global(name)
            if name not in self.unpicklable_names:
                self.unpicklable_names.append(name)

    def remove_unpicklable_name(self, name):
        """Removes a name from the list of unpicklable names, if it exists.

        Args:
          name: string, the name of the unpicklable global to remove
        """
        if name in self.unpicklable_names:
            self.unpicklable_names.remove(name)

    def fast_dumps(self, obj, protocol=None):
        """Performs the same function as pickle.dumps but with optimizations off.

        Args:
          obj: object, object to be pickled
          protocol: int, optional protocol option to emulate pickle.dumps

        Note: It is necessary to pickle SymPy values with the fast option in order
              to get the correct assumptions when unpickling. See Issue 2587.
        """
        file = StringIO()
        p = pickle.Pickler(file, protocol)
        p.fast = 1
        p.dump(obj)
        return file.getvalue()
