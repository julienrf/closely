package play.closely

import javax.inject.{Inject, Provider, Singleton}
import play.api.http.Status._
import play.api.mvc._
import play.api.{Configuration, Environment, Mode}
import play.api.Logger

import scala.concurrent.ExecutionContext

/**
 * A filter that redirects HTTP requests to https requests.
 *
 * To enable this filter, please add it to to your application.conf file using
 * "play.filters.enabled+=play.filters.https.RedirectHttpsFilter"
 *
 * For documentation on configuring this filter, please see the Play documentation at
 * https://www.playframework.com/documentation/latest/RedirectHttpsFilter
 */
@Singleton
class RedirectHttpsFilter @Inject() (config: RedirectHttpsConfiguration)(implicit ec: ExecutionContext) extends EssentialFilter {

  import RedirectHttpsKeys._
  import config._

  private val logger = Logger(getClass)

  private[this] lazy val stsHeaders = {
    if (!redirectEnabled) Seq.empty
    else strictTransportSecurity.toSeq.map("Strict-Transport-Security" -> _)
  }

  override def apply(next: EssentialAction): EssentialAction = EssentialAction { req =>
    import play.api.libs.streams.Accumulator
    // The file has been entirely copied from Play source code
    // but the following line has been modified to match heroku’s policy
    if (req.headers.get("X-Forwarded-Proto").contains("https")) {
      next(req).map(_.withHeaders(stsHeaders: _*))
    } else if (redirectEnabled) {
      Accumulator.done(Results.Redirect(createHttpsRedirectUrl(req), redirectStatusCode))
    } else {
      logger.info(s"Not redirecting to HTTPS because $redirectEnabledPath flag is not set.")
      next(req)
    }
  }

  protected def createHttpsRedirectUrl(req: RequestHeader): String = {
    import req.{ domain, uri }
    sslPort match {
      case None | Some(443) =>
        s"https://$domain$uri"
      case Some(port) =>
        s"https://$domain:$port$uri"
    }
  }
}

case class RedirectHttpsConfiguration(
    strictTransportSecurity: Option[String] = Some("max-age=31536000; includeSubDomains"),
    redirectStatusCode: Int = PERMANENT_REDIRECT,
    sslPort: Option[Int] = None, // should match up to ServerConfig.sslPort
    redirectEnabled: Boolean = true
) {
  def hstsEnabled: Boolean = redirectEnabled && strictTransportSecurity.isDefined
}

private object RedirectHttpsKeys {
  val stsPath = "play.filters.https.strictTransportSecurity"
  val statusCodePath = "play.filters.https.redirectStatusCode"
  val portPath = "play.filters.https.port"
  val redirectEnabledPath = "play.filters.https.redirectEnabled"
}

@Singleton
class RedirectHttpsConfigurationProvider @Inject() (c: Configuration, e: Environment)
  extends Provider[RedirectHttpsConfiguration] {
  import RedirectHttpsKeys._

  private val logger = Logger(getClass)

  lazy val get: RedirectHttpsConfiguration = {
    val strictTransportSecurity = c.getString(stsPath)
    val redirectStatusCode = c.getInt(statusCodePath).get
    if (!(redirectStatusCode / 100 == 3)) {
      throw c.reportError(statusCodePath, s"Status Code $redirectStatusCode is not a Redirect status code!")
    }
    val port = c.getInt(portPath)
    val redirectEnabled = c.getBoolean(redirectEnabledPath).getOrElse {
      if (e.mode != Mode.Prod) {
        logger.info(
          s"RedirectHttpsFilter is disabled by default except in Prod mode.\n" +
            s"See https://www.playframework.com/documentation/2.6.x/RedirectHttpsFilter"
        )
      }
      e.mode == Mode.Prod
    }

    RedirectHttpsConfiguration(strictTransportSecurity, redirectStatusCode, port, redirectEnabled)
  }
}

/**
 * The Redirect to HTTPS filter components for compile time dependency injection.
 */
trait RedirectHttpsComponents {
  def configuration: Configuration
  def environment: Environment
  def executionContext: ExecutionContext

  lazy val redirectHttpsConfiguration: RedirectHttpsConfiguration =
    new RedirectHttpsConfigurationProvider(configuration, environment).get
  lazy val redirectHttpsFilter: RedirectHttpsFilter =
    new RedirectHttpsFilter(redirectHttpsConfiguration)(executionContext)
}
