import Foundation
import EventKit
import Contacts

@objc(EteSyncNative)
class EteSyncNative: NSObject {
    let taskQueue = DispatchQueue(label: "com.etesync.DispatchQueue", attributes: .concurrent)
    
    @objc(hashEvent:resolve:reject:)
    func hashEvent(eventId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        let store = EKEventStore()
        if let event = store.calendarItem(withIdentifier: eventId) as! EKEvent? {
            resolve(etesync.hashEvent(event: event))
        } else {
            reject("no_event", String(format: "Event with identifier %@ not found", eventId), nil)
        }
    }
    
    @objc(calculateHashesForEvents:from:to:resolve:reject:)
    func calculateHashesForEvents(calendarId: String, from: NSNumber, to: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let store = EKEventStore()
            guard let cal = store.calendar(withIdentifier: calendarId) else {
                reject("no_calendar", String(format: "Calendar with identifier %@ not found", calendarId), nil)
                return
            }
            
            let start = Date(timeIntervalSince1970: TimeInterval(from.doubleValue))
            let end = Date(timeIntervalSince1970: TimeInterval(to.doubleValue))
            
            let predicate = store.predicateForEvents(withStart: start, end: end, calendars: [cal])
            
            let events = store.events(matching: predicate)
            
            var handled = Set<String>()
            var ret: [Any] = []
            
            for event in events {
                if (handled.contains(event.calendarItemIdentifier)) {
                    continue
                }
                handled.insert(event.calendarItemIdentifier)
                
                ret.append([
                    event.calendarItemIdentifier,
                    etesync.hashEvent(event: event)
                ])
            }
            
            resolve(ret)
        }
    }
    
    @objc(hashReminder:resolve:reject:)
    func hashReminder(reminderId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        let store = EKEventStore()
        if let reminder = store.calendarItem(withIdentifier: reminderId) as! EKReminder? {
            resolve(etesync.hashReminder(reminder: reminder))
        } else {
            reject("no_reminder", String(format: "Reminder with identifier %@ not found", reminderId), nil)
        }
    }
    
    @objc(calculateHashesForReminders:resolve:reject:)
    func calculateHashesForReminders(calendarId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let store = EKEventStore()
            guard let cal = store.calendar(withIdentifier: calendarId) else {
                reject("no_calendar", String(format: "Calendar with identifier %@ not found", calendarId), nil)
                return
            }
            
            let predicate = store.predicateForReminders(in: [cal])
            
            store.fetchReminders(matching: predicate, completion: { reminders in
                if (reminders == nil) {
                    resolve([])
                    return
                }

                resolve(reminders!.map{ reminder in
                    [
                        reminder.calendarItemIdentifier,
                        etesync.hashReminder(reminder: reminder)
                    ]
                })
            })
        }
    }
    
    static let keysToFetch = [
        CNContactIdentifierKey,
        CNContactTypeKey,
        CNContactPropertyAttribute,
        CNContactNamePrefixKey,
        CNContactGivenNameKey,
        CNContactMiddleNameKey,
        CNContactFamilyNameKey,
        CNContactPreviousFamilyNameKey,
        CNContactNameSuffixKey,
        CNContactNicknameKey,
        CNContactJobTitleKey,
        CNContactDepartmentNameKey,
        CNContactOrganizationNameKey,
        CNContactPostalAddressesKey,
        CNContactEmailAddressesKey,
        CNContactUrlAddressesKey,
        CNContactInstantMessageAddressesKey,
        CNContactPhoneNumbersKey,
        CNContactBirthdayKey,
        CNContactDatesKey,
        // CNContactNoteKey,
        CNContactImageDataAvailableKey,
        CNContactThumbnailImageDataKey,
        CNContactRelationsKey,
        CNContactInstantMessageAddressesKey,
    ] as [CNKeyDescriptor]

    @objc(hashContact:resolve:reject:)
    func hashContact(contactId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        let store = CNContactStore()
        let predicate = CNContact.predicateForContacts(withIdentifiers: [contactId])
        let fetchRequest = CNContactFetchRequest(keysToFetch: EteSyncNative.keysToFetch)
        fetchRequest.unifyResults = false
        fetchRequest.predicate = predicate
        
        var ret: String? = nil
        do {
            try store.enumerateContacts(with: fetchRequest, usingBlock: { (contact, _) in
                ret = etesync.hashContact(contact: contact)
            })
        } catch {
            reject("fetch_failed", "Failed fethcing contact", error)
            return
        }
        
        if (ret == nil) {
            reject("not_found", String(format: "Contact with id %@ not found", contactId), nil)
        }
        
        resolve(ret)
    }
    
    @objc(calculateHashesForContacts:resolve:reject:)
    func calculateHashesForContacts(containerId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        taskQueue.async {
            let store = CNContactStore()
            let predicate = CNContact.predicateForContactsInContainer(withIdentifier: containerId)
            let fetchRequest = CNContactFetchRequest(keysToFetch: EteSyncNative.keysToFetch)
            fetchRequest.unifyResults = false
            fetchRequest.predicate = predicate
            
            var ret: [[String]] = []
            do {
                try store.enumerateContacts(with: fetchRequest, usingBlock: { (contact, _) in
                    ret.append([
                        contact.identifier,
                        etesync.hashContact(contact: contact)
                    ])
                })
            } catch {
                reject("fetch_failed", "Failed fethcing contacts", error)
                return
            }
            
            resolve(ret)
        }
    }
}
