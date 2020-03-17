from django.db import models
from django.contrib.auth.models import User


class Searches(models.Model):
    user_id = models.ForeignKey(User, on_delete=models.CASCADE)
    query = models.TextField(default=None)
    timestamp = models.DateTimeField(auto_now_add=True)
    private = models.BooleanField()

    class Meta:
        verbose_name_plural = "Searches"
