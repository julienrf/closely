package closely

import play.api.mvc.QueryStringBindable

case class BoundingBox(north: Double, east: Double, south: Double, west: Double)

object BoundingBox {

  implicit def querystringBindable(implicit double: QueryStringBindable[Double]): QueryStringBindable[BoundingBox] =
    new QueryStringBindable[BoundingBox] {
      def unbind(k: String, bb: BoundingBox): String =
        Seq(
          double.unbind(s"$k.n", bb.north),
          double.unbind(s"$k.e", bb.east),
          double.unbind(s"$k.s", bb.south),
          double.unbind(s"$k.w", bb.west)
        ).mkString("&")
      def bind(k: String, params: Map[String, Seq[String]]): Option[Either[String, BoundingBox]] =
        for {
          n <- double.bind(s"$k.n", params)
          e <- double.bind(s"$k.e", params)
          s <- double.bind(s"$k.s", params)
          w <- double.bind(s"$k.w", params)
        } yield {
          for {
            nn <- n.right
            ee <- e.right
            ss <- s.right
            ww <- w.right
          } yield BoundingBox(nn, ee, ss, ww)
        }
      override def javascriptUnbind: String =
        s"""
          function(k,v) {
            var d = ${double.javascriptUnbind};
            return [d(k+'.n', v.north), d(k+'.e', v.east), d(k+'.s', v.south), d(k+'.w', v.west)].join('&');
          }
        """
    }

}