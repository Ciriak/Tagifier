//
//  Konami code for dev Tools
//

var k = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65],
r = require('electron').remote,
n = 0;
$(document).keydown(function (e) {
    if (e.keyCode === k[n++]) {
        if (n === k.length) {
            r.getCurrentWindow().toggleDevTools();
            n = 0;
            return false;
        }
    }
    else {
        n = 0;
    }
});
