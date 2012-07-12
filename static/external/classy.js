/**
 * Classy - classy classes for JavaScript
 *
 * :copyright: (c) 2011 by Armin Ronacher.
 * :license: BSD.
 */
!function(d){"undefined"!=typeof module&&module.exports?module.exports=d():"function"==typeof define&&"object"==typeof define.amd?define(d):this.Class=d()}(function(d){function h(a,b){return Object.prototype.hasOwnProperty.call(a,b)?a[b]:d}function m(a){n=!0;a=new a;n=!1;return a}var k=this,l=k.Class,n=!1,q=0<function(){$super()}.toString().indexOf("$super"),b=function(){};b.$noConflict=function(){try{l===d?delete k.Class:k.Class=l}catch(a){k.Class=l}return b};b.$classyVersion="1.4";b.$extend=function(a){var p=
this.prototype,e=m(this);if(a.__include__)for(var i=0,l=a.__include__.length;i!=l;++i){var o=a.__include__[i],f;for(f in o){var c=h(o,f);c!==d&&(e[f]=o[f])}}a.__classvars__=a.__classvars__||{};if(e.__classvars__)for(var j in e.__classvars__)a.__classvars__[j]||(c=h(e.__classvars__,j),a.__classvars__[j]=c);for(f in a)c=h(a,f),"__include__"===f||c===d||(e[f]="function"===typeof c&&(!q||/\B\$super\b/.test(c.toString()))?function(a,c){return function(){var b=h(this,"$super");this.$super=p[c];try{return a.apply(this,
arguments)}finally{b===d?delete this.$super:this.$super=b}}}(c,f):c);var g=function(){if(!n){var a=k===this?m(arguments.callee):this;a.__init__&&a.__init__.apply(a,arguments);a.$class=g;return a}};for(j in a.__classvars__)c=h(a.__classvars__,j),c!==d&&(g[j]=c);g.prototype=e;g.constructor=g;g.$extend=b.$extend;g.$withData=b.$withData;return g};b.$withData=function(a){var b=m(this),e;for(e in a){var i=h(a,e);i!==d&&(b[e]=i)}return b};return b});
