import React from 'react'
import SmallLoader from 'components/shared/small_loader'

export default class ServerForm extends React.Component {

  componentDidMount(){
    this.refs.name.focus()
  }

  _onSubmit(e){
    e.preventDefault()
    this.props.onSubmit({name: this.refs.name.value})
  }

  render(){
    return (
      <form className="object-form add-local-key"
            onSubmit={this._onSubmit.bind(this)}>

        <fieldset>
          <input className="local-key-name"
                 ref="name"
                 placeholder="Local Dev Key Name"
                 required />
        </fieldset>

        <fieldset>{this._renderSubmit()}</fieldset>
      </form>
    )
  }

  _renderSubmit(){
    if(this.props.isSubmitting){
      return <SmallLoader />
    } else {
      return <button> <span>Add Local Dev Key</span> </button>
    }
  }
}