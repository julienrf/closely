package closely

import controllers.Assets
import play.api.http.HttpErrorHandler
import play.api.libs.ws.ning.NingWSComponents
import play.api.mvc._
import play.api.{Logger, BuiltInComponentsFromContext, Application, ApplicationLoader}
import play.api.ApplicationLoader.Context

import scala.concurrent.Future

class Loader extends ApplicationLoader {
  def load(context: Context): Application = new BuiltInComponentsFromContext(context) with NingWSComponents {
    override lazy val httpErrorHandler =
      new HttpErrorHandler with Rendering with AcceptExtractors with Results {
        def onServerError(request: RequestHeader, exception: Throwable): Future[Result] = {
          Logger.error(s"Internal server error, for (${request.method}) [${request.uri}]", exception)
          Future.successful {
            render {
              case Accepts.Json() => InternalServerError
              case _ => InternalServerError(html.serverError())
            }(request)
          }
        }
        def onClientError(request: RequestHeader, statusCode: Int, message: String): Future[Result] =
          Future.successful{
            render {
              case Accepts.Json() => Status(statusCode)
              case _ => Status(statusCode)(html.clientError(message))
            }(request)
          }
      }
    val openStreetMap = new OpenStreetMap(wsClient, actorSystem)
    val hostname = configuration.getString("hostname").getOrElse("localhost:9000")
    val controller = new Closely(openStreetMap, hostname)
    val router = new _root_.router.Routes(httpErrorHandler, controller, new Assets(httpErrorHandler))
  }.application
}
