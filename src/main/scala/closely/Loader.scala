package closely

import controllers.Assets
import play.api.http.HttpErrorHandler
import play.api.libs.ws.ning.NingWSComponents
import play.api.mvc.{Results, Result, RequestHeader}
import play.api.{Logger, BuiltInComponentsFromContext, Application, ApplicationLoader}
import play.api.ApplicationLoader.Context

import scala.concurrent.Future

class Loader extends ApplicationLoader {
  def load(context: Context): Application = new BuiltInComponentsFromContext(context) with NingWSComponents {
    override lazy val httpErrorHandler =
      new HttpErrorHandler {
        def onServerError(request: RequestHeader, exception: Throwable): Future[Result] = {
          Logger.error(s"Internal server error, for (${request.method}) [${request.uri}]", exception)
          Future.successful(Results.InternalServerError(html.serverError()))
        }
        def onClientError(request: RequestHeader, statusCode: Int, message: String): Future[Result] =
          Future.successful(Results.Status(statusCode)(html.clientError(message)))
      }
    val openStreetMap = new OpenStreetMap(wsClient, actorSystem)
    val hostname = configuration.getString("hostname").getOrElse("localhost:9000")
    val controller = new Controller(openStreetMap, hostname)
    val router = new _root_.router.Routes(httpErrorHandler, controller, new Assets(httpErrorHandler))
  }.application
}
