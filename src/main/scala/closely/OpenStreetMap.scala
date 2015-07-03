package closely

import akka.actor.{Props, ActorSystem, Actor}
import akka.util.Timeout
import play.api.libs.json._
import play.api.libs.ws.WSClient
import play.api.libs.concurrent.Execution.Implicits.defaultContext

import scala.concurrent.Future
import scala.util.{Failure, Success, Try}

import play.api.libs.functional.syntax._

class OpenStreetMap(wsClient: WSClient, system: ActorSystem) {
  import TagInfoActor._
  import akka.pattern.ask
  import scala.concurrent.duration.DurationInt

  implicit val timeout = Timeout(1.second)

  val ref = system.actorOf(Props(new TagInfoActor(wsClient)))

  system.scheduler.schedule(0.second, 1.day, ref, Fetch)

  def tagInfos(): Future[Seq[String]] = (ref ? Get).mapTo[Seq[String]]

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

    def search(amenity: String, box: BoundingBox): Future[JsValue] =
      wsClient.url("http://overpass-api.de/api/interpreter")
        .withQueryString("data" ->
          s"""
             [out:json][timeout:20];
             (
               node["amenity"="$amenity"](${box.south},${box.west},${box.north},${box.east});
               way["amenity"="$amenity"](${box.south},${box.west},${box.north},${box.east});
               relation["amenity"="$amenity"](${box.south},${box.west},${box.north},${box.east});
             );
             out body;
            """)
        .get()
        .filter(_.status == 200)
        .flatMap { response =>
          Future.fromTry(Try(response.json))
        }

}

class TagInfoActor(wsClient: WSClient) extends Actor {
  import TagInfoActor._
  import akka.pattern.pipe

  var tags = Seq.empty[String]

  def receive: Receive = {
    case Get =>
      sender() ! tags
    case Fetch =>
      wsClient
        .url("http://taginfo.openstreetmap.org/api/4/key/values")
        .withQueryString("key" -> "amenity", "sortname" -> "value")
        .get()
        .flatMap { response =>
        Future.fromTry(Try(response.json).flatMap { json =>
          json.validate(
            (__ \ "data").read(
              Reads.seq(
                (__ \ "value").read[String]
              )
            )
          ) match {
            case JsSuccess(newTags, _) => Success(Update(newTags))
            case JsError(errors) => Failure(new Exception("Unable to decode JSON response"))
          }
        }).pipeTo(self)
      }
    case Update(newTags) =>
      tags = newTags
  }
}

object TagInfoActor {
  case object Get
  case object Fetch
  case class Update(tags: Seq[String])
}

