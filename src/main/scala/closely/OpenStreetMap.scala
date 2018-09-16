package closely

import akka.actor.{Actor, ActorSystem}
import play.api.Logger
import play.api.libs.json._
import play.api.libs.ws.WSClient
import play.api.libs.concurrent.Execution.Implicits.defaultContext

import scala.concurrent.Future
import scala.util.{Failure, Success, Try}
import play.api.libs.functional.syntax._

class OpenStreetMap(wsClient: WSClient, system: ActorSystem) {

  def geocode(query: String): Future[Option[(Double, Double)]] =
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
        points.headOption
      })
    }

    def search(tagKey: String, tagValue: String, box: BoundingBox): Future[JsValue] =
      wsClient.url("http://overpass-api.de/api/interpreter")
        .withQueryString("data" ->
          s"""
             [out:json][timeout:20];
             (
               node["$tagKey"="$tagValue"](${box.south},${box.west},${box.north},${box.east});
               way["$tagKey"="$tagValue"](${box.south},${box.west},${box.north},${box.east});
               relation["$tagKey"="$tagValue"](${box.south},${box.west},${box.north},${box.east});
             );
             out body;
            """)
        .get()
        .map { response =>
          Logger.debug(s"Overpass response: ${response.status} ${response.body}")
          response
        }
        .filter(_.status == 200)
        .flatMap { response =>
          Future.fromTry(Try(response.json))
        }

}

// Not used anymore
// But might be useful later…
class TagInfoActor(wsClient: WSClient) extends Actor {
  import TagInfoActor._
  import akka.pattern.pipe

  var tags = Map.empty[String, Seq[String]]

  def receive: Receive = {
    case Get =>
      sender() ! tags
    case Fetch =>
      def fetchValues(key: String): Future[(String, Seq[String])] =
        wsClient
          .url("http://taginfo.openstreetmap.org/api/4/key/values")
          .withQueryString("key" -> key)
          .get()
          .flatMap { response =>
            Future.fromTry(Try(response.json).flatMap { json =>
              json.validate(
                (__ \ "data").read(
                  Reads.seq(
                    (
                      (__ \ "value").read[String] ~
                      (__ \ "count").read[Int]
                    ).tupled
                  )
                )
              ) match {
                case JsSuccess(values, _) => Success(key -> values.collect { case (v, n) if n > 1000 => v }.sorted)
                case JsError(errors) => Failure(new Exception("Unable to decode JSON response"))
              }
            })
          }

      val keys = Seq("amenity", "bicycle", "emergency", "historic", "leisure", "natural", "tourism", "wheelchair"/*, "waterway"*/)

      Future.sequence(keys.map(fetchValues))
        .map(tags => Update(tags.toMap))
        .pipeTo(self)

    case Update(newTags) =>
      tags = newTags
  }
}

object TagInfoActor {
  case object Get
  case object Fetch
  case class Update(tags: Map[String, Seq[String]])
}

