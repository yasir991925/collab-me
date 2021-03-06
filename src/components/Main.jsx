//Imports required npm packages
import React from 'react';
import {
    Editor,
    convertToRaw,
    convertFromRaw,
    EditorState,
    RichUtils,
    Modifier,
    ContentState,
    CompositeDecorator,
    generateDecorator
} from 'draft-js';
import {Link, Route} from 'react-router-dom';
import axios from 'axios';
import socketIOClient from "socket.io-client";
import {CopyToClipboard} from 'react-copy-to-clipboard';
import {connect} from 'react-redux';
//Requires necessary components
import History from './History.jsx';
import {currentDoc} from '../actions/index.js'
import createStyles from 'draft-js-custom-styles'

//Creates main editor page using draftjs and react
class Main extends React.Component {
    constructor(props) {
        super(props);
        //Estbalishes required states
        this.state = {
            editorState: EditorState.createEmpty(),
            size: 12,
            color: "red",
            backend: '',
            client: '',
            response: false,
            endpoint: "http://192.168.1.118:8000",
            copied: false,
            search: '',
            history: [],
            name: '',
            id: ''
        };
        //Creates socket connection first to be used throughout the file
        this.socket = socketIOClient(this.state.endpoint);
        this.handleKeyCommand = this.handleKeyCommand.bind(this);
    }

    //Ends sockets when learving component
    componentWillUnmount() {
        this.socket.off('disconnect')
    }
    //When reaching component actions are established
    componentWillMount() {
        let self = this;
        //Endpoints
        //Creates share endpoint to save user data
        axios.get('http://localhost:3000/shared', {
            params: {
                id: self.props.current._id
            }
        }).then(function(response) {
            self.props.setCurrentDoc(response.data);
        }).then(function(response) {
            self.setState({
                name: self.props.current.name,
                id: self.props.current._id,
                editorState: EditorState.createWithContent(convertFromRaw(JSON.parse(self.props.current.rawContent))),
                history: self.props.current.history
            });
        }).catch(function(error) {
            // console.log(error);
        });
        //socket endpoints

        //Emits when user joins the document: needs to occur at the start
        this.socket.emit('join-document', {docId: this.props.current._id , userToken: this.props.user._id}, (ack) => {
          // console.log(this.props.current._id, this.props.user._id)
          if(!ack) console.error('Error joining document!')
          self.secretToken = ack.secretToken
          self.docId = ack.docId
          //takes state from other sockets if provided
          if(ack.state) {
            this.setState({
              editorState:EditorState.createWithContent(convertFromRaw(ack.state))
            })
          }
        })

        //socket takes update from other users
        this.socket.on('document-update', (update) => {
            const {state, docId, userToken} = update;
            //confirms you are not yourself else it is an infinite loop
            //currently there is an issue if you are on two different tabs - meaning no updates
            if (this.props.user._id !== userToken) {
                this.setState({
                    editorState: EditorState.createWithContent(convertFromRaw(state))
                })
            }
        })
    }

    //Helper functions
    //
    //Sends user data for socket users to see real time changes
    onChange(editorState) {
        this.setState({
            editorState
        }, () => {
            const {secretToken, docId} = this
            console.log(secretToken, docId, 'onChange')
            const state = convertToRaw(this.state.editorState.getCurrentContent())
            this.socket.emit('document-save', {
                userToken: this.props.user._id,
                secretToken,
                state,
                docId
            })
        })
    }

    //Updates state with onChange command
    handleKeyCommand(command, editorState) {
        const newState = RichUtils.handleKeyCommand(editorState, command);
        if (newState) {
            this.onChange(newState);
            return 'handled';
        }
        return 'not-handled';
    }
    //Rich Utils Css updates for text
    //Bolding Text
    _onBoldClick() {
        this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'BOLD'));
    }
    //Italicizing Text
    _onItalicsClick() {
        this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'ITALIC'));
    }
    //Underlining Text
    _onUnderlineClick() {
        this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'UNDERLINE'));
    }
    //Striking through Text
    _onStrikethroughClick() {
        this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'STRIKETHROUGH'));
    }
    // Aligning Right Text
    _onRightAlignClick() {
        this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'ALIGNRIGHT'));
    }
    // Aligning Left Text
    _onLeftAlignClick() {
        this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'ALIGNLEFT'));
    }
    // Aligning Center Text
    _onCenterAlignClick() {
        this.onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'ALIGNCENTER'));
    }

    _onUnorderedListClick() {
      this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'unordered-list-item'));
    }
    _onOrderedListClick() {
      this.onChange(RichUtils.toggleBlockType(this.state.editorState, 'ordered-list-item'));
    }


    //Handles the Font size and colors of the text
    handleFontSizeChange(event) {
      // this.setState({size: event.target.value});
      let self = this;
      // console.log('change font')
      const newEditorState = styles.fontSize.toggle(self.state.editorState, event.target.value)
      // console.log(newEditorState)
      this.onChange(newEditorState);
    }

    handleFontColorChange(event) {
      let self = this;
      const newEditorState = styles.color.toggle(self.state.editorState, event.target.value);
      this.onChange(newEditorState);
    }

    //Saves the documents in the database
    saveDoc() {
        //Creates current History and collaborators
        let currentHistory;
        let collaborators;

        this.state.history
            ? currentHistory = this.state.history
            : currentHistory = []
        //Adds the current content at a point of time in the history
        currentHistory.push({
            content: JSON.stringify(convertToRaw(this.state.editorState.getCurrentContent())).toString(),
            contributor: this.props.user._id,
            updated_at: new Date()
        })

        if (this.props.current.collaborators) {
            if (this.props.current.collaborators.indexOf(this.props.user._id) !== -1) {
                collaborators = this.props.current.collaborators;
                collaborators.push(this.props.user._id);
            }
        } else {
            collaborators = [];
            collaborators.push(this.props.user._id);
        }

        axios.post('http://localhost:3000/update', {
            id: this.props.current._id,
            currentContent: JSON.stringify(convertToRaw(this.state.editorState.getCurrentContent())),
            collaborators: collaborators,
            history: currentHistory
        }).then(function(response) {
            console.log("Updated!");
        }).catch(function(error) {
            console.log(error);
        });

    }

    //Copies sharable ID
    onCopy() {
        this.setState({copied: true});
    }

    //Checks seraching while in the file
    handleSearchChange(event) {
        const state = this.state;
        let self = this;
        state[event.target.name] = event.target.value;
        this.setState(state);
        this.setState({
            editorState: EditorState.set(self.state.editorState, {
                decorator: self.generateDecorator(event.target.value)
            })
        });
    }

    // Create regex containing our search term
    generateDecorator(highlightTerm) {
        const regex = new RegExp(highlightTerm, 'g');
        return new CompositeDecorator([
            {
                strategy: (contentBlock, callback) => {
                    if (highlightTerm !== '') {
                        this.findWithRegex(regex, contentBlock, callback);
                    }
                },
                component: this.SearchHighlight
            }
        ])
    };

    // Highlight class applied
    SearchHighlight(props) {
        return (<span className="search-and-replace-highlight" style={{
                color: "red"
            }}>{props.children}</span>)
    };

    // Regex used to find the text ranges that we want to decorate
    findWithRegex(regex, contentBlock, callback) {
        const text = contentBlock.getText();
        let matchArr,
            start,
            end;
        while ((matchArr = regex.exec(text)) !== null) {
            start = matchArr.index;
            end = start + matchArr[0].length;
            callback(start, end);
        }
    };
    //Renders Application HTML
    render() {
        return (<div className="container">
            <div className="row">

                <div className="col-lg-3 col-md-2"></div>
                <div className="col-lg-6 col-md-8 login-box">
                    <Link to={{
                            pathname: '/documents'
                        }} className="btn btn-outline-secondary">Go Back</Link>

                    <div className="col-lg-12 login-title">
                        {this.state.name}
                    </div>
                    <div className="col-lg-12 login-form">
                        <div className="col-lg-12 login-form">
                            <label className="form-control-label">SHAREABLE ID: {this.state.id}</label>
                            <CopyToClipboard text={this.state.id} onCopy={this.onCopy.bind(this)}>
                                <button className="btn btn-xs btn-default" title="copy">
                                    <i className="fa fa-copy"></i>
                                    Copy to Clipboard</button>
                            </CopyToClipboard>
                            <div>{
                                    this.state.copied
                                        ? <span>
                                                <i>ID Copied.</i>
                                            </span>
                                        : null
                                }</div>
                        </div>
                        <div className="container">
                            <label className="form-control-label">Client: {this.state.client}</label>
                            <label className="form-control-label">Backend: {this.state.backend}</label>
                        </div>
                        <div className="col-lg-12">
                            <div className="col-lg-12">
                                <div className="form-group">
                                    <label className="form-control-label">SEARCH DOCUMENT:</label>
                                    <input type="text" name="search" className="form-control" value={this.state.search} onChange={this.handleSearchChange.bind(this)}/>
                                </div>
                            </div>
                        </div>
                        <div className='btn-group'>
                            <div className="dropdown">
                                <label className="form-control-label">FONT COLOR:</label>
                                <select value={this.state.value} onChange={this.handleFontColorChange.bind(this)} className="btn btn-xs btn-default dropdown-toggle" name="color">
                                    <option className="dropdown-item" value="black">Black</option>
                                    <option className="dropdown-item" value="red">Red</option>
                                    <option className="dropdown-item" value="orange">Orange</option>
                                    <option className="dropdown-item" value="yellow">Yellow</option>
                                    <option className="dropdown-item" value="green">Green</option>
                                    <option className="dropdown-item" value="blue">Blue</option>
                                    <option className="dropdown-item" value="purple">Purple</option>
                                </select>
                            </div>
                            <div className="dropdown">
                                <label className="form-control-label">FONT SIZE:</label>
                                <select value={this.state.value} onChange={this.handleFontSizeChange.bind(this)} className="btn btn-xs btn-default dropdown-toggle" name="color">
                                    <option className="dropdown-item" value="12">12</option>
                                    <option className="dropdown-item" value="16">16</option>
                                    <option className="dropdown-item" value="18">18</option>
                                    <option className="dropdown-item" value="22">22</option>
                                    <option className="dropdown-item" value="24">24</option>
                                    <option className="dropdown-item" value="26">26</option>
                                    <option className="dropdown-item" value="28">28</option>
                                </select>
                            </div>
                        </div>
                        <div className='btn-group'>
                            <button className="btn btn-xs btn-default" title="bold" onClick={this._onBoldClick.bind(this)}>
                                <i className="fa fa-bold"></i>
                            </button>
                            <button className="btn btn-xs btn-default" title="italic" onClick={this._onItalicsClick.bind(this)}>
                                <i className="fa fa-italic"></i>
                            </button>
                            <button className="btn btn-xs btn-default" title="underline" onClick={this._onUnderlineClick.bind(this)}>
                                <i className="fa fa-underline"></i>
                            </button>
                            <button className="btn btn-xs btn-default" title="strikethrough" onClick={this._onStrikethroughClick.bind(this)}>
                                <i className="fa fa-strikethrough"></i>
                            </button>
                        </div>
                        <div className='btn-group'>
                            <button className="btn btn-xs btn-default" title="left-align" onClick={this._onLeftAlignClick.bind(this)}>
                                <i className="fa fa-align-left"></i>
                            </button>
                            <button className="btn btn-xs btn-default" title="center-align" onClick={this._onCenterAlignClick.bind(this)}>
                                <i className="fa fa-align-justify"></i>
                            </button>
                            <button className="btn btn-xs btn-default" title="right-align" onClick={this._onRightAlignClick.bind(this)}>
                                <i className="fa fa-align-right"></i>
                            </button>
                        </div>
                        <div className='btn-group'>
                            <button className="btn btn-xs btn-default" title="bulleted-list" onClick={this._onUnorderedListClick.bind(this)}>
                                <i className="fa fa-list-ul"></i>
                            </button>
                            <button className="btn btn-xs btn-default" title="numbered-list" onClick={this._onOrderedListClick.bind(this)}>
                                <i className="fa fa-list-ol"></i>
                            </button>
                        </div>
                        <button className="btn btn-xs btn-default" title="custom">Custom</button>
                        <div className="editor">
                            <Editor customStyleMap={styleMap} customStyleFn={customStyleFn} editorState={this.state.editorState} handleKeyCommand={this.handleKeyCommand} onChange={(editorState) => this.onChange(editorState)}/>
                        </div>
                        <p>
                            <button onClick={this.saveDoc.bind(this)} className="btn btn-outline-primary" title="save">Save Changes</button>
                        </p>
                        <p>
                            <Link to={{
                                    pathname: '/history'
                                }} className="btn btn-outline-secondary">View History</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>);
    }
}


//Styles for the custom functions created
const styleMap = {
    'ALIGNRIGHT': {
        textAlign: 'right',
        display: 'inline-block',
        width: '100%'
    },
    'ALIGNLEFT': {
        textAlign: 'left',
        display: 'inline-block',
        width: '100%'
    },
    'ALIGNCENTER': {
        textAlign: 'center',
        display: 'inline-block',
        width: '100%'
    },
    'LIST': {
      display: 'block',
      listStyleType: 'none',
      position: 'relative'
    }
};

const { styles, customStyleFn, exporter } = createStyles(['font-size', 'color'], 'PREFIX', styleMap);

//redux for function and props usage in react
const mapStateToProps = (state) => {
    return {current: state.current, user: state.user};
}

const mapDispatchToProps = (dispatch) => {
    return {
        setCurrentDoc: (doc) => {
            dispatch(currentDoc(doc))
        }
    }
}

// Promote App from a component to a container
Main = connect(mapStateToProps, mapDispatchToProps)(Main);

//Exports file
export default Main;
