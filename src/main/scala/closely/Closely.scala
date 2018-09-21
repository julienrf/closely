package closely

import play.api.libs.concurrent.Execution.Implicits.defaultContext
import play.api.libs.json.Json
import play.api.mvc.{RequestHeader, Result, Action}
import play.api.routing.JavaScriptReverseRouter
import play.twirl.api.JavaScript

class Closely(openStreetMap: OpenStreetMap, hostname: String) extends play.api.mvc.Controller {

  val index = {
    val htmlContent = html.index()
    Action { request =>
      taggedResult(request, htmlContent.body.hashCode.toString) {
        Ok(htmlContent)
      }
    }
  }

  def geocode(query: String) = Action.async {
    openStreetMap.geocode(query).map {
      case Some((lat, lon)) => Ok(Json.obj("lat" -> lat, "lon" -> lon))
      case None => NotFound
    }
  }

  def search(tagKey: String, tagValue: String, box: BoundingBox) = Action.async {
    openStreetMap.search(tagKey, tagValue, box).map { json =>
      Ok(json)
    }
  }

  val javascriptRoutes = {
    val router =
      JavaScriptReverseRouter("routes", None, hostname,
        routes.javascript.Closely.search,
        routes.javascript.Closely.geocode
      )

    Action { request =>
      taggedResult(request, router.body.hashCode.toString) {
        Ok(JavaScript(s"""define(function () { ${router.body}; return routes })"""))
      }
    }
  }

  def taggedResult(request: RequestHeader, tag: String)(result: => Result): Result =
    request.headers.get(IF_NONE_MATCH) match {
      case Some(t) if t == tag => NotModified
      case _ => result.withHeaders(ETAG -> tag)
    }

  val webmanifest = {
    val contents = Json.obj(
      "name"             -> "Closely",
      "background_color" -> "white",
      "display"          -> "standalone",
      "start_url"        -> closely.routes.Closely.index().url,
      "icons"            -> Json.arr(
        Json.obj(
          "src"   -> controllers.routes.Assets.versioned("icon.png").url,
          "sizes" -> "48x48",
          "type"  -> "image/png"
        )
      )
    )
    Action {
      Ok(contents)
    }
  }

}