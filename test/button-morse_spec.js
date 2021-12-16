var helper = require('node-red-contrib-button-morse');
var bm_node = require('../button-morse.js');

describe('button-morse Node', function() {
    afterEach(function() {
        helper.unload();
    });

    
    it('should be loaded', function(done) {
      var flow = [
        { id: "n1", type: "button-morse", name: "First Button-morse" }
      ];
      var n1 = helper.getNode("n1");
      n1.should.have.property('name', flow[0]["name"]);
      done();
    });

});
