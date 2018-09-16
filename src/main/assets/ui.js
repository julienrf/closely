define(['el', 'option'], function (el, option) {

  var removeChildren = function (node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  };

  return function (state) {
    // TODO Use inline CSS instead of ids
    var map = el('div', {id: 'map'})();
    var thingSelect = el('select', { id: 'thing', title: 'Type of things to show on the map' })();
    var whereInput = el('input', {type: 'text', id: 'where', placeholder: 'Search for a location'})();
    var locateMeBtn = el('button', {title: 'Use my current location', id: 'locate-me'})('\u2316');
    var toggleBtn = el('button', { title: 'Toggle the visibility of the control panel' })(state.controlsAreVisible ? '\u25C0' : '\u25B6');
    var controlsAttrs = { id: 'controls' };
    if (!state.controlsAreVisible) { controlsAttrs['style'] = 'display: none;'; }
    var controls =
      el('div', controlsAttrs)(
        el('div', {id: 'location'})(
          el('form', {id: 'where-wrapper'})(whereInput),
          el('span', {id: 'locate-me-wrapper'})(locateMeBtn)
        ),
        el('div', {id: 'tag'})(thingSelect)
      );
    var root =
      el('div', { style: 'height: 100%' })(
        map,
        el('div', { id: 'controls-and-handle' })(
          controls,
          el('div', {id: 'handle'})(toggleBtn)
        )
      );

    return {
      root: root,
      map: map,
      thingSelect: thingSelect,
      whereInput: whereInput,
      locateMeBtn: locateMeBtn,
      toggleBtn: toggleBtn,
      // TODO Manipulate the dom efficiently
      update: {
        thingSelect: function(state, things) {
          removeChildren(thingSelect);
          Object.keys(things).forEach(function (key) {
            var thing = things[key];
            var attrs = { value: key };
            if (state.selectedThing === key) {
              attrs.selected = 'selected';
            }
            thingSelect.appendChild(el('option', attrs)(thing.label))
          });
        },
        controls: function (state) {
          if (state.controlsAreVisible) {
            controls.style.display = 'table-cell';
            toggleBtn.textContent = '\u25C0';
          } else {
            controls.style.display = 'none';
            toggleBtn.textContent = '\u25B6';
          }
        }
      }
    }
  }
});