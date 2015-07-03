package closely

import play.api.libs.concurrent.Execution.Implicits.defaultContext
import play.api.libs.json.Json
import play.api.mvc.{RequestHeader, Result, Action, Cookie}
import play.api.routing.JavaScriptReverseRouter
import play.twirl.api.JavaScript

class Controller(openStreetMap: OpenStreetMap, hostname: String) extends play.api.mvc.Controller {

  val lastSearchCookie = "last-search"

  val index = Action.async { request =>
    for {
      amenities <- openStreetMap.tagInfos()
      lastSearch = request.cookies.get(lastSearchCookie).map(_.value)
    } yield Ok(html.index(/*amenities*/Seq("recycling", "drinking_water"), lastSearch))
  }

  def geocode(query: String) = Action.async {
    openStreetMap.geocode(query).map {
      case Some((lat, lon)) => Ok(Json.obj("lat" -> lat, "lon" -> lon))
      case None => NotFound
    }
  }

  def search(amenity: String, box: BoundingBox) = Action.async {
    openStreetMap.search(amenity, box).map { json =>
      Ok(json).withCookies(Cookie(lastSearchCookie, amenity))
    }
  }

  val javascriptRoutes = {
    val router =
      JavaScriptReverseRouter("routes", None, hostname,
        routes.javascript.Controller.search,
        routes.javascript.Controller.geocode
      )
    val routerTag = router.body.hashCode.toString

    Action { request =>
      taggedResult(request, routerTag) {
        Ok(JavaScript(s"""define(function () { ${router.body}; return routes })"""))
      }
    }
  }

  def taggedResult(request: RequestHeader, tag: String)(result: => Result): Result =
    request.headers.get(IF_NONE_MATCH) match {
      case Some(t) if t == tag => NotModified
      case _ => result.withHeaders(ETAG -> tag)
    }

}