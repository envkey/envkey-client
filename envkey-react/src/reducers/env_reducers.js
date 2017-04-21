import R from 'ramda'
import {
  CREATE_ENTRY,
  UPDATE_ENTRY,
  REMOVE_ENTRY,
  UPDATE_ENTRY_VAL,

  GENERATE_ENV_UPDATE_ID,
  UPDATE_ENV_REQUEST,
  UPDATE_ENV_API_SUCCESS,
  UPDATE_ENV_SUCCESS,
  UPDATE_ENV_FAILED,

  FETCH_OBJECT_DETAILS_API_SUCCESS,
  FETCH_OBJECT_DETAILS_SUCCESS,
  FETCH_OBJECT_DETAILS_FAILED,

  ADD_ASSOC_REQUEST,
  ADD_ASSOC_SUCCESS,
  ADD_ASSOC_FAILED,

  REMOVE_ASSOC_REQUEST,
  REMOVE_ASSOC_SUCCESS,
  REMOVE_ASSOC_FAILED,

  REMOVE_OBJECT_REQUEST,
  REMOVE_OBJECT_SUCCESS,
  REMOVE_OBJECT_FAILED,

  LOGOUT,
  SELECT_ORG,

  COMMIT_IMPORT_ACTIONS
} from "actions"
import {
  rawEnv,
  createEntry,
  updateEntry,
  removeEntry,
  updateEntryVal
} from 'lib/env/transform'
import { isOutdatedEnvsResponse } from 'lib/actions'

const

  addOrRemoveAssocRequestReducer = (state = {}, action)=>{
    const {parentType, parentId, assocType, assocId} = action.meta
    if (!(parentType == "app" && assocType == "service"))return state

    const appendKey = {[ADD_ASSOC_REQUEST]: "addServiceIds", [REMOVE_ASSOC_REQUEST]: "removeServiceIds"}[action.type],
          appendPath = [parentId, appendKey],
          appendToArr = R.path(appendPath, state) || [],
          appended = R.append(assocId, appendToArr),

          removeKey = {[ADD_ASSOC_REQUEST]: "removeServiceIds", [REMOVE_ASSOC_REQUEST]: "addServiceIds"}[action.type],
          removePath = [parentId, removeKey],
          removeFromArr = R.path(removePath, state) || [],
          removed = R.without([assocId], removeFromArr)

    return R.pipe(
      R.assocPath(appendPath, appended),
      R.assocPath(removePath, removed)
    )(state)
  },

  addOrRemoveAssocSuccessReducer = (state = {}, action)=>{
    const {parentType, parentId, assocType, assocId} = action.meta
    if (!(parentType == "app" && assocType == "service"))return state
    const k = {[ADD_ASSOC_SUCCESS]: "addServiceIds", [REMOVE_ASSOC_SUCCESS]: "removeServiceIds"}[action.type],
          path = [parentId, k],
          addOrRemoveArr = R.path(path, state)

    return R.assocPath(path, R.without([assocId], addOrRemoveArr), state)
  },

  removeObjectRequestReducer = (state = {}, action)=>{
    const {objectType, targetId} = action.meta
    if (objectType != "service")return state

    const removeServiceIds = R.append(targetId, (state.removeServiceIds || []))
    return R.assoc("removeServiceIds", removeServiceIds, state)
  },

  removeObjectSuccessReducer = (state = {}, action)=>{
    const {objectType, targetId} = action.meta
    if (objectType != "service")return state

    const removeServiceIds = R.without([targetId], (state.removeServiceIds || []))
    return R.assoc("removeServiceIds", removeServiceIds, state)
  },

  envActionsPendingTransformEnvReducer = (state, action)=>{
    if(R.path(["meta", "queued"], action)){
      return state
    }
    const {parentId, envUpdateId} = action.meta,
          path = [parentId, envUpdateId],
          queueAction = {...action, meta: {...action.meta, queued: true}}

    return R.path(path, state) ?
      R.over(R.lensPath(path), R.concat([queueAction]), state) :
      R.assocPath(path, [queueAction], state)
  },

  envActionsPendingCommitImportReducer = (state, action)=>{
    const {parentId, envUpdateId} = action.meta,
          path = [parentId, envUpdateId],
          queueActions = action.payload.map(pendingAction => ({
            ...pendingAction,
            meta: {...pendingAction.meta, importAction: false, queued: true}
          }))

    return R.path(path, state) ?
      R.over(R.lensPath(path), R.concat(queueActions), state) :
      R.assocPath(path, queueActions, state)
  }

export const

  lastAddedEntry = (state = {}, action)=>{
    switch(action.type){
      case CREATE_ENTRY:
      case UPDATE_ENTRY:
        if(action.meta.importAction)return state

        const {meta: {parentId, timestamp}, payload: {entryKey, newKey}} = action,
              res = action.type == UPDATE_ENTRY ? {entryKey: newKey, timestamp} : {entryKey, timestamp}

        return R.assoc(parentId, res)(state)

      case LOGOUT:
      case SELECT_ORG:
        return {}

      default:
        return state
    }
  },

  envActionsPending = (state = {}, action)=>{
    switch(action.type){
      case CREATE_ENTRY:
      case UPDATE_ENTRY:
      case REMOVE_ENTRY:
      case UPDATE_ENTRY_VAL:
        if(action.meta.importAction){
          return state
        } else {
          return envActionsPendingTransformEnvReducer(state, action)
        }

      case COMMIT_IMPORT_ACTIONS:
        return envActionsPendingCommitImportReducer(state, action)

      case UPDATE_ENV_SUCCESS:
        return R.pipe(
          R.dissocPath([action.meta.parentId, action.meta.envUpdateId]),
          R.reject(R.isEmpty)
        )(state)

      case LOGOUT:
      case SELECT_ORG:
        return {}

      default:
        return state
    }
  },

  isRequestingEnvUpdate = (state = {}, action)=>{
    switch(action.type){
      case UPDATE_ENV_REQUEST:
        return R.assoc(action.meta.parentId, true, state)

      case UPDATE_ENV_SUCCESS:
      case UPDATE_ENV_FAILED:
        if (isOutdatedEnvsResponse(action)){
          return state
        } else {
          return R.dissoc(action.meta.parentId)
        }

      default:
        return state
    }
  },

  isUpdatingOutdatedEnvs = (state = {}, action)=>{
    switch(action.type){
      case UPDATE_ENV_FAILED:
        if (isOutdatedEnvsResponse(action)){
          return R.assoc(action.meta.parentId, true, state)
        } else {
          return state
        }

      case FETCH_OBJECT_DETAILS_SUCCESS:
      case FETCH_OBJECT_DETAILS_FAILED:
        if (action.meta.isOutdatedEnvsRequest){
          return R.dissoc(action.meta.targetId, state)
        } else {
          return state
        }

      default:
        return state
    }
  },

  isRebasingOutdatedEnvs = (state = {}, action)=>{
    switch(action.type){
      case UPDATE_ENV_FAILED:
        if (isOutdatedEnvsResponse(action)){
          return R.assoc(action.meta.parentId, true, state)
        } else {
          return state
        }

      case UPDATE_ENV_REQUEST:
        if (action.meta.isOutdatedEnvsRequest){
          return R.dissoc(action.meta.parentId, state)
        } else {
          return state
        }

      default:
        return state
    }
  },

  envUpdateId = (state = {}, action)=>{
    switch(action.type){
      case GENERATE_ENV_UPDATE_ID:
        return R.assoc(action.meta.parentId, action.payload, state)

      case UPDATE_ENV_REQUEST:
        return action.meta.forceEnvUpdateId ?
          state :
          R.assoc(action.meta.parentId, action.meta.nextEnvUpdateId, state)

      default:
        return state
    }
  }






