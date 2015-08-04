define(function () {
  return {
    map: function (maybe, f) {
      if (maybe === null) return null;
      else return f(maybe);
    }
  }
});