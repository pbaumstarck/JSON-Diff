
import base64
import jinja2
import json
import logging
import os
import random
import re
import webapp2

from google.appengine.ext import ndb
from google.appengine.ext.webapp import template

JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    extensions=["jinja2.ext.autoescape"],
    autoescape=True)


class SavedDiff(ndb.Model):
  """A saved diff between two JSON objects."""
  # The state JSON object of the diff.
  state_json_obj = ndb.JsonProperty(required=True)
  # When this diff was created.
  created = ndb.DateTimeProperty(auto_now_add=True)


def GetRandomId():
  """Gets a random ID to assign a diff."""
  return base64.b64encode(str(random.random())[2:].zfill(12))


class MainPage(webapp2.RequestHandler):

  def save(self):
    response = None
    if not re.match(
        r"https?://(localhost:\d+|jsondiff\.itsagoldenage\.com)/.*",
        self.request.referer):
      response = {
          "success": False,
          "message": "Bad referer.",
      }
    else:
      try:
        state_json_str = self.request.get("state_json")
        state_json_obj = json.loads(state_json_str)
        model_id = GetRandomId()
        while SavedDiff.get_by_id(model_id):
          model_id = GetRandomId()
        model = SavedDiff(id=model_id, state_json_obj=state_json_obj)
        model.put()
        logging.info("Saved state object with ID: %s", model_id)
        response = {
            "success": True,
            "model_id": model_id,
        }
      except Exception as e:
        response = {
            "success": False,
            "message": "Failed to save your diff.",
        }
    self.response.out.write(json.dumps(response))

  # def test(self):
  #   template = JINJA_ENVIRONMENT.get_template("test.html")
  #   self.response.write(template.render({}))

  def get(self, model_id=None):
    arguments = {
        "state_json_str": json.dumps(""),
    }
    logging.info("model_id: %s", model_id)
    if model_id:
      model = SavedDiff.get_by_id(model_id)
      if model:
        arguments["state_json_str"] = json.dumps(model.state_json_obj)
    template = JINJA_ENVIRONMENT.get_template("index.html")
    self.response.write(template.render(arguments))


app = webapp2.WSGIApplication([
    webapp2.Route(r"/_save", MainPage, handler_method="save"),
    webapp2.Route(r"/<model_id:.{6,}>", MainPage, handler_method="get"),
    webapp2.Route(r"/test", MainPage, handler_method="test"),
    webapp2.Route(r"/", MainPage, handler_method="get"),
], debug=True)
