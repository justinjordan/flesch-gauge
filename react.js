import React, { Component } from 'react'
import FleschGauge from './dist/bundle.js'

class FleschGaugeComponent extends Component {
  constructor(props) {
    super(props)

    this.elementRef = React.createRef()
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.fleschGauge) {
      this.fleschGauge.$set(nextProps)
      return false
    }

    return true
  }

  render() {
    return React.createElement('div', { ref: this.elementRef })
  }

  componentDidMount() {
    if (!this.fleschGauge) {
      this.fleschGauge = new FleschGauge({
        target: this.elementRef.current,
        props: {
          content: this.props.content,
        },
      })
    }
  }
}

export default FleschGaugeComponent