package closely

import play.api.libs.json.{Json, Reads, __}
import play.api.libs.ws.WSClient
import play.api.mvc.Action
import play.api.routing.JavaScriptReverseRouter
import play.api.libs.concurrent.Execution.Implicits.defaultContext
import play.twirl.api.JavaScript

import scala.concurrent.Future
import scala.util.Try
import play.api.libs.functional.syntax._

class Controller(wsClient: WSClient) extends play.api.mvc.Controller {

  val index = {
    val htmlContent = html.index()
    Action {
      Ok(htmlContent) // TODO Cache
    }
  }

  val javascriptRoutes = Action { implicit request =>
    val router =
      JavaScriptReverseRouter("routes")(
        routes.javascript.Controller.search,
        routes.javascript.Controller.geocode
      )
    Ok(JavaScript(s"""define(function () { $router; return routes })""")) // TODO Cache
  }

  def geocode(query: String) = Action.async {
    wsClient.url("http://nominatim.openstreetmap.org/search")
      .withQueryString("format" -> "json", "q" -> query)
      .get()
      .flatMap { response =>
        Future.fromTry(Try(response.json).map { json =>
          val points = json.validate(
            Reads.seq(
              (
                (__ \ "lat").read[String].map(_.toDouble) ~
                (__ \ "lon").read[String].map(_.toDouble)
              ).tupled
            )
          ).getOrElse(sys.error(s"Unable to parse JSON response: ${Json.prettyPrint(json)}"))
          points.headOption match {
            case Some((lat, lon)) => Ok(Json.obj("lat" -> lat, "lon" -> lon))
            case None => NotFound
          }
        })
      }
  }

  def search(box: BoundingBox) = Action.async {
    wsClient.url("http://overpass-api.de/api/interpreter")
      .withQueryString("data" ->
        s"""
           [out:json];
           node(${box.south},${box.west},${box.north},${box.east});
           node(around:300)["amenity"="recycling"]["recycling:glass"="yes"];
           out body;
          """)
      .get()
      .filter(_.status == OK)
      .flatMap { response =>
        Future.fromTry(Try(response.json).map { json =>
          Ok(json)
        })
      }
  }

}