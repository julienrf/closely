require.config({
  baseUrl: '/assets',
  paths: {
    'leaflet': 'leaflet-0.7.7/leaflet'
  }
});

require(['leaflet', 'routes', 'option', 'ui', 'ajax', 'el'], function (L, routes, option, Ui, ajax, el) {

  var persistedState =
    option.map(window.localStorage.getItem('state'), function (_) { return JSON.parse(_) });

  var state = {
    knownPois: [], // Coordinates of already known pois
    poisLayer: L.layerGroup(), // Layer of pois
    myLocation: null, // Marker showing my location
    selectedKey: option.map(persistedState, function (_) { return _.selectedKey }),
    selectedValue: option.map(persistedState, function (_) { return _.selectedValue }),
    locationAndZoom: option.map(persistedState, function (_) { return _.locationAndZoom }),
    controlsAreVisible: option.fold(persistedState, function () { return true }, function (_) { return _.controlsAreVisible }),
    tags: option.map(window.localStorage.getItem('tags'), function (_) { return JSON.parse(_) }) // FIXME load them lazily
  };

  window.addEventListener('beforeunload', function () {
    window.localStorage.setItem('state', JSON.stringify({
      selectedKey: state.selectedKey,
      selectedValue: state.selectedValue,
      locationAndZoom: state.locationAndZoom,
      controlsAreVisible: state.controlsAreVisible
    }));
  });

  var ui = Ui(state);

  // TODO handle expiration
  if (state.tags === null || Object.keys(state.tags).length === 0) {
    ajax(routes.closely.Closely.tags(), function (json) {
      state.tags = json;
      window.localStorage.setItem('tags', JSON.stringify(state.tags));
      ui.update.keySelect(state);
      ui.update.valueSelect(state);
    });
  } else {
    ui.update.keySelect(state);
    ui.update.valueSelect(state);
  }

  ui.keySelect
    .addEventListener('change', function () {
      state.selectedKey = ui.keySelect.value;
      state.selectedValue = null;
      ui.update.valueSelect(state);
    });

  ui.valueSelect
    .addEventListener('change', function () {
      state.selectedValue = ui.valueSelect.value;
      state.knownPois = [];
      state.poisLayer.clearLayers();
      triggerSearch();
    });

  L.Icon.Default.imagePath = '/assets/leaflet-0.7.7/images/'; // See https://github.com/Leaflet/Leaflet/issues/766

  var map = L.map(ui.map, { minZoom: 15, zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  map.addControl(L.control.zoom({ position: 'bottomright' }));
  state.poisLayer.addTo(map);

  map.on('locationfound', function (e) {
    map.setView(e.latlng, 17);
    if (state.myLocation === null) {
      state.myLocation = L.circleMarker(e.latlng);
      state.myLocation.addTo(map);
    } else {
      state.myLocation.setLatLng(e.latlng);
    }
  });

  ui.locateMeBtn
    .addEventListener('click', function () {
      map.locate();
    });

  ui.whereInput.form
    .addEventListener('submit', function (e) {
      e.preventDefault();
      ajax(
        routes.closely.Closely.geocode(ui.whereInput.value),
        function (point) {
          map.setView([point.lat, point.lon], 17);
        }, function () {
          alert('Unable to find the given location')
        }
      );
    });

  var triggerSearch = function () {
    state.locationAndZoom = {
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom()
    };
    var bounds = map.getBounds();
    ajax(
      routes.closely.Closely.search(state.selectedKey, state.selectedValue, {
        north: bounds._northEast.lat,
        east: bounds._northEast.lng,
        south: bounds._southWest.lat,
        west: bounds._southWest.lng
      }), function (json) {
        json.elements
          .filter(function (e) { return e.type === 'node' && state.knownPois.indexOf(e.id) === -1 })
          .forEach(function (e) {
            state.knownPois.push(e.id);
            state.poisLayer.addLayer(
              L.marker([e.lat, e.lon])
                .bindPopup(el('ul')(
                  Object.keys(e.tags || {}).map(function (tag) {
                    return el('li')(el('strong')(tag), ': ' + e.tags[tag])
                  })
                ))
            );
          });
      }
    );
  };

  map.on('moveend', function () {
    if (state.selectedKey !== null && state.selectedValue !== null) {
      triggerSearch();
    }
  });

  if (state.locationAndZoom !== null) {
    map.setView(L.latLng(state.locationAndZoom.lat, state.locationAndZoom.lng), state.locationAndZoom.zoom);
  }

  ui.toggleBtn.addEventListener('click', function () {
    state.controlsAreVisible = !state.controlsAreVisible;
    ui.update.controls(state);
  });

  document.body.appendChild(ui.root);
  map.invalidateSize();

});