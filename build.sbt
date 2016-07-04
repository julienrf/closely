name := "closely"

enablePlugins(PlayScala, GitVersioning)

disablePlugins(PlayLayoutPlugin)

libraryDependencies += ws

routesGenerator := InjectedRoutesGenerator

pipelineStages := Seq(rjs, digest, gzip)

scalaVersion := "2.11.8"

herokuAppName in Compile := "closely"

herokuProcessTypes in Compile := Map(
  "web" -> ("target/universal/stage/bin/" ++ name.value ++ " -Dhttp.port=$PORT -Dplay.crypto.secret=$SECRET")
)

RjsKeys.paths += "routes" -> ("routes", "empty:")
