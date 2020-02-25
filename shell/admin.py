from django.contrib import admin
from .models import Searches
from django.contrib.sessions.models import Session


class SearchesEntry(admin.ModelAdmin):
    list_display = ("id", "user_id", "query", "timestamp", "private")


class SessionEntry(admin.ModelAdmin):
    list_display = ("session_key", "expire_date", "session_data")


admin.site.register(Searches, SearchesEntry)
admin.site.register(Session, SessionEntry)
