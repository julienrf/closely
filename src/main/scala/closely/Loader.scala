package closely

import controllers.Assets
import play.api.http.HttpErrorHandler
import play.api.mvc._
import play.api.{Application, ApplicationLoader, BuiltInComponentsFromContext, Logger}
import play.api.ApplicationLoader.Context
import play.api.libs.ws.ahc.AhcWSComponents
import play.closely.RedirectHttpsComponents

import scala.concurrent.Future

class Loader extends ApplicationLoader {
  def load(context: Context): Application = new BuiltInComponentsFromContext(context) with AhcWSComponents with RedirectHttpsComponents {
    def executionContext = play.api.libs.concurrent.Execution.Implicits.defaultContext
    override lazy val httpFilters: Seq[EssentialFilter] = redirectHttpsFilter :: Nil
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
