require.config({
  baseUrl: '/assets',
  paths: {
    'leaflet': 'leaflet-0.7.3/leaflet',
    'qajax': 'qajax.min'
  }
});

require(['leaflet', 'routes', 'qajax', 'el'], function (L, routes, qajax, el) {

  var ajax = function (endpoint, opts) {
    opts = opts || {};
    opts.url = endpoint.url;
    opts.method = endpoint.method;
    return qajax(opts)
      .then(qajax.filterSuccess)
      .then(qajax.toJSON);
  };

  var knownPois = [];

  var map = L.map(document.getElementById('map'), { minZoom: 15 });
  L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  map.on('locationfound', function (e) {
    map.setView(e.latlng, 17);
    L.circleMarker(e.latlng).addTo(map);
  });

  document.getElementById('locate-me')
    .addEventListener('click', function () {
      map.locate();
    });

  var whereInput = document.getElementById('where');
  whereInput.form
    .addEventListener('submit', function (e) {
      e.preventDefault();
      ajax(routes.closely.Controller.geocode(whereInput.value))
        .then(function (point) {
          map.setView([point.lat, point.lon], 17);
        });
    });

  map.on('moveend', function () {
    var bounds = map.getBounds();
    ajax(routes.closely.Controller.search({
      north: bounds._northEast.lat,
      east: bounds._northEast.lng,
      south: bounds._southWest.lat,
      west: bounds._southWest.lng
    }))
      .then(function (json) {
        json.elements
          .filter(function (e) { return knownPois.indexOf(e.id) === -1 })
          .forEach(function (e) {
            knownPois.push(e.id);
            L.marker([e.lat, e.lon])
              .bindPopup(el('ul')(
                Object.keys(e.tags || {}).map(function (tag) {
                  return el('li')(el('strong')(tag), ': ' + e.tags[tag])
                })
              ))
              .addTo(map);
          });
      })
  });

});