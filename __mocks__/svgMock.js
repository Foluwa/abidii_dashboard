const React = require('react');

module.exports = React.forwardRef(function SvgMock(props, ref) {
  return React.createElement('svg', { ...props, ref });
});
