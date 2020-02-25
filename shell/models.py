from django.db import models
from django.contrib.auth.models import User


class Searches(models.Model):
    user_id = models.ForeignKey(User, on_delete=models.CASCADE)
    query = models.CharField(max_length=100, default=None)
    timestamp = models.DateTimeField(auto_now_add=True)
    private = models.BooleanField()

    class Meta:
        verbose_name_plural = "Searches"


# class SessionTable(models.Model):
#     global_names = models.CharField(max_length=50)
#     globals = models.BinaryField()
#     unpicklable_names = models.CharField(max_length=30)
#     unpicklables = models.CharField(max_length=30)
