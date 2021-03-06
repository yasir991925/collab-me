// Importing needed npm packages
import React from 'react';
import axios from 'axios';
//Imports redux capabilities
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux';
import {setDocuments} from '../actions/index.js'
import {deleteUser} from '../actions/index.js'
//Imports different react components
import Document from './Document.jsx'
import AddDocument from './AddDocument.jsx'
import ViewShared from './ViewShared.jsx'

class Documents extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    //Occurs immediately at component render
    componentWillMount() {
        let self = this;
        //Loads all documents after login
        axios.get('http://localhost:3000/documents', {
            params: {
                id: self.props.user._id
            }
        }).then(function(response) {
            self.props.setDocs(response.data);
        }).catch(function(error) {
            console.log(error);
        });
    }
    //Logout capabities
    logout() {
        let self = this;
        axios.get('http://localhost:3000/logout').then(function(response) {
            self.props.clearUser(self.props.user);
            self.props.setDocs({});
        }).then(function(response) {
            self.props.history.push('/');
        }).catch(function(error) {
            console.log(error);
        });
    }

    render() {
        const {response} = this.state;
        return (<div className="container">
            <div className="row">
                <div className="col-lg-3 col-md-2"></div>
<div className="col-lg-6 col-md-8 login-box">
    <div className="col-lg-12 login-form">

            <button type="submit" onClick={this.logout.bind(this)} className="btn btn-outline-secondary">Logout</button>
            <AddDocument/>
            <div className="col-lg-12 login-title">
                LIST OF DOCUMENTS
            </div>
            <ul>
                {
                    this.props.documents.length > 0
                        ? this.props.documents.map((doc) => <Document key={doc.id} doc={doc}/>)
                        : ''
                }
            </ul>
            <ViewShared/>
        </div></div></div></div>);
    }
}
//Redux creation of props and functions
const mapStateToProps = (state) => {
    return {documents: state.documents,
        user: state.user};
}

const mapDispatchToProps = (dispatch) => {
    return {
        setDocs: (documents) => {
            dispatch(setDocuments(documents))
        },
        clearUser: (user) => {
            dispatch(deleteUser(user))
        }
    }
}
export default connect(mapStateToProps, mapDispatchToProps)(Documents)
