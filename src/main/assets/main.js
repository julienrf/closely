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

  var whatSelect = document.getElementById('what');
  var whereInput = document.getElementById('where');
  var locateMeBtn = document.getElementById('locate-me');

  var state = {
    knownPois: [],
    amenity: whatSelect.value
  };

  var map = L.map(document.getElementById('map'), { minZoom: 15 });
  L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  map.on('locationfound', function (e) {
    map.setView(e.latlng, 17);
    L.circleMarker(e.latlng).addTo(map); // TODO Store the marker and modify it
  });

  locateMeBtn
    .addEventListener('click', function () {
      map.locate();
    });

  whatSelect
    .addEventListener('change', function (e) {
      state.amenity = e.target.value;
    });

  whereInput.form
    .addEventListener('submit', function (e) {
      e.preventDefault();
      ajax(routes.closely.Controller.geocode(whereInput.value))
        .then(function (point) {
          map.setView([point.lat, point.lon], 17);
        }, function () {
          alert('Unable to find the given location')
        });
    });

  map.on('moveend', function () {
    var bounds = map.getBounds();
    ajax(routes.closely.Controller.search(state.amenity, {
      north: bounds._northEast.lat,
      east: bounds._northEast.lng,
      south: bounds._southWest.lat,
      west: bounds._southWest.lng
    }))
      .then(function (json) {
        json.elements
          .filter(function (e) { return state.knownPois.indexOf(e.id) === -1 })
          .forEach(function (e) {
            state.knownPois.push(e.id);
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