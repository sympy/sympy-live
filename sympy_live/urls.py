"""sympy_live URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from shell import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('evaluate', views.evaluate, name='evaluate'),
    path('forcedesktop/', views.force_desktop_cookie, name='forcedesktop'),
    path('delete', views.delete, name='delete'),
    path('complete', views.complete, name='complete'),
    path('sphinxbanner', views.sphinxbanner, name='sphinxbanner'),
    path('shellmobile', views.redirect, name='shellmobile'),
    path('shelldsi', views.redirect, name='shelldsi'),
    path('helpdsi', views.redirect, name='helpdsi'),
]
