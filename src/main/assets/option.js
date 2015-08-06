define(function () {
  return {
    map: function (maybe, f) {
      if (maybe === null) return null;
      else return f(maybe);
    },
    getOrElse: function (maybe, fEmpty) {
      if (maybe === null) return fEmpty();
      else return maybe;
    },
    fold: function (maybe, fEmpty, fSome) {
      if (maybe === null) return fEmpty();
      else return fSome(maybe);
    }
  }
});