import Foundation
import SQLite3

struct Job {
    var id: NSString
    var workerName: NSString
    var active:Int32
    var payload: NSString
    var metaData: NSString
    var attempts: Int32
    var created: NSString
    var failed: NSString
    var timeout: Int32
    var priority: Int32
    var isDeleted: Int32
    var status: NSString
}
extension Job: SQLTable {
    static var createStatement: String {
        return """
        CREATE TABLE IF NOT EXISTS Job(
        id CHAR(36) PRIMARY KEY NOT NULL,
        worker_name CHAR(255) NOT NULL,
        active INTEGER NOT NULL,
        payload CHAR(1024),
        meta_data CHAR(1024),
        attempts INTEGER NOT NULL,
        created CHAR(255),
        failed CHAR(255),
        timeout INTEGER NOT NULL,
        priority Integer NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        status CHAR(255)
        );
        """
    }
    static func createJobFromDictionary(job:[String:Any])->Job{
        return Job(id:job["id"] as! NSString,
                   workerName: job["workerName"] as! NSString,
                   active:job["active"] as! Int32,
                   payload:job["payload"] as! NSString,
                   metaData: job["metaData"] as! NSString,
                   attempts: job["attempts"] as! Int32,
                   created: job["created"] as! NSString,
                   failed: job["failed"] as! NSString,
                   timeout: job["timeout"] as! Int32,
                   priority: job["priority"] as! Int32,
                   isDeleted: job["isDeleted"] as! Int32,
                   status: job["status"] as! NSString)
    }
    func toDictionary()->[String:Any]{
        var jobAsDictionary=[String:Any]()
        jobAsDictionary["id"]=self.id
        jobAsDictionary["workerName"]=self.workerName
        jobAsDictionary["active"]=self.active
        jobAsDictionary["payload"]=self.payload
        jobAsDictionary["metaData"]=self.metaData
        jobAsDictionary["attempts"]=self.attempts
        jobAsDictionary["created"]=self.created
        jobAsDictionary["failed"]=self.failed
        jobAsDictionary["timeout"]=self.timeout
        jobAsDictionary["priority"]=self.priority
        jobAsDictionary["isDeleted"]=self.isDeleted
        jobAsDictionary["status"]=self.status
        return jobAsDictionary;
    }
}
extension SQLiteDatabase {
    func add(job: Job) throws {
        let insertSql = "INSERT INTO job (id, worker_name, active, payload, meta_data, attempts, created, failed, timeout, priority, is_deleted, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);"
        let insertStatement = try prepareStatement(sql: insertSql)
        defer {
            sqlite3_finalize(insertStatement)
        }
        
        guard (sqlite3_bind_text(insertStatement, 1, job.id.utf8String,-1,nil) == SQLITE_OK  &&
            sqlite3_bind_text(insertStatement, 2, job.workerName.utf8String, -1, nil) == SQLITE_OK &&
            sqlite3_bind_int(insertStatement, 3, job.active) == SQLITE_OK &&
            sqlite3_bind_text(insertStatement, 4, job.payload.utf8String, -1, nil) == SQLITE_OK &&
            sqlite3_bind_text(insertStatement, 5, job.metaData.utf8String, -1, nil) == SQLITE_OK &&
            sqlite3_bind_int(insertStatement, 6, job.attempts) == SQLITE_OK &&
            sqlite3_bind_text(insertStatement, 7, job.created.utf8String, -1, nil) == SQLITE_OK &&
            sqlite3_bind_text(insertStatement, 8, job.failed.utf8String, -1, nil) == SQLITE_OK &&
            sqlite3_bind_int(insertStatement, 9, job.timeout) == SQLITE_OK &&
            sqlite3_bind_int(insertStatement, 10, job.priority) == SQLITE_OK &&
            sqlite3_bind_int(insertStatement, 11, job.isDeleted) == SQLITE_OK &&
            sqlite3_bind_text(insertStatement, 12, job.status.utf8String, -1, nil) == SQLITE_OK
            
            )else {
                throw SQLiteError.Bind(message: errorMessage)
        }
        
        guard sqlite3_step(insertStatement) == SQLITE_DONE else {
            throw SQLiteError.Step(message: errorMessage)
        }
    }
    func getJobBy(id: NSString) -> Job? {
        let querySql = "SELECT * FROM job WHERE id = ? AND is_deleted = 0;"
        guard let queryStatement = try? prepareStatement(sql: querySql) else {
            return nil
        }
        
        defer {
            sqlite3_finalize(queryStatement)
        }
        
        guard sqlite3_bind_text(queryStatement, 1, id.utf8String,-1,nil) == SQLITE_OK
            else {
                return nil
        }
        
        guard sqlite3_step(queryStatement) == SQLITE_ROW else {
            return nil
        }
        
        return mapColumnsToJob(sqlStatement: queryStatement)
    }
    func getNextJob() -> Job? {
        let querySql = "SELECT * FROM job WHERE active == 0 AND status != 'failed' AND status != 'cancelled' AND is_deleted = 0 ORDER BY priority DESC,datetime(created) LIMIT 1;"
        guard let queryStatement = try? prepareStatement(sql: querySql) else {
            return nil
        }
        
        defer {
            sqlite3_finalize(queryStatement)
        }
        
        guard sqlite3_step(queryStatement) == SQLITE_ROW else {
            return nil
        }
        
        return mapColumnsToJob(sqlStatement: queryStatement)
    }
    func getWorkInProgressJob() -> Job? {
        let querySql = "SELECT * FROM job WHERE active == 0 AND status == 'processing' AND is_deleted = 0 ORDER BY priority DESC,datetime(created) LIMIT 1;"
        guard let queryStatement = try? prepareStatement(sql: querySql) else {
            return nil
        }
        
        defer {
            sqlite3_finalize(queryStatement)
        }
        
        guard sqlite3_step(queryStatement) == SQLITE_ROW else {
            return nil
        }
        
        return mapColumnsToJob(sqlStatement: queryStatement)
    }
    func getJobsForWorker(name:NSString,count:Int32) -> [Job]? {
        let querySql = "SELECT * FROM job WHERE active == 0 AND status != 'failed' AND status != 'cancelled' AND worker_name == ? AND is_deleted = 0 ORDER BY priority DESC,datetime(created) LIMIT ?;"
        guard let queryStatement = try? prepareStatement(sql: querySql) else {
            return nil
        }
        defer {
            sqlite3_finalize(queryStatement)
        }
        
        guard (sqlite3_bind_text(queryStatement, 1, name.utf8String,-1,nil) == SQLITE_OK &&
            sqlite3_bind_int(queryStatement, 2, count) == SQLITE_OK)else {
                return nil
        }
        
        var jobs = [Job]()
        while(sqlite3_step(queryStatement) == SQLITE_ROW){
            if let job=mapColumnsToJob(sqlStatement: queryStatement){
                jobs.append(job)
            }
        }
        
        return jobs
    }
    func getJobsForWorkerWithDeleted(name:NSString,count:Int32) -> [Job]? {
        let querySql = "SELECT * FROM job WHERE active == 0 AND worker_name == ? ORDER BY priority DESC,datetime(created) LIMIT ?;"
        guard let queryStatement = try? prepareStatement(sql: querySql) else {
            return nil
        }
        defer {
            sqlite3_finalize(queryStatement)
        }
        
        guard (sqlite3_bind_text(queryStatement, 1, name.utf8String,-1,nil) == SQLITE_OK &&
            sqlite3_bind_int(queryStatement, 2, count) == SQLITE_OK)else {
                return nil
        }
        
        var jobs = [Job]()
        while(sqlite3_step(queryStatement) == SQLITE_ROW){
            if let job=mapColumnsToJob(sqlStatement: queryStatement){
                jobs.append(job)
            }
        }
        
        return jobs
    }
    func getJobs() -> [Job]? {
        let querySql = "SELECT * FROM job WHERE is_deleted = 0 ORDER BY priority DESC,datetime(created);"
        return getJobsByQuery(query: querySql)
    }
    func getJobsWithDeleted() -> [Job]? {
        let querySql = "SELECT * FROM job ORDER BY priority DESC,datetime(created);"
        return getJobsByQuery(query: querySql)
    }
    func getActiveMarkedJobs() -> [Job]? {
        let querySql = "SELECT * FROM job WHERE active == 1 AND is_deleted = 0;" 
        return getJobsByQuery(query: querySql)
    }
    func getJobsByQuery(query:String)->[Job]?{
        let modifiedQuery: String
        if query.lowercased().contains("where") {
            modifiedQuery = query.replacingOccurrences(of: "where", with: "WHERE is_deleted = 0 AND", options: .caseInsensitive, range: nil)
        } else {
            modifiedQuery = query + " WHERE is_deleted = 0"
        }
        guard let queryStatement = try? prepareStatement(sql: modifiedQuery) else {
            return nil
        }
        defer {
            sqlite3_finalize(queryStatement)
        }
        
        var jobs = [Job]()
        while(sqlite3_step(queryStatement) == SQLITE_ROW){
            if let job=mapColumnsToJob(sqlStatement: queryStatement){
                jobs.append(job)
            }
        }
        
        return jobs
    }

    func deletePermanently(job: Job) throws{
        let querySql = "DELETE FROM job WHERE id = ?;"
        guard let deleteStatement = try? prepareStatement(sql: querySql) else {
            throw SQLiteError.Prepare(message: errorMessage)
        }
        
        defer {
            sqlite3_finalize(deleteStatement)
        }
        
        guard sqlite3_bind_text(deleteStatement, 1, job.id.utf8String,-1,nil) == SQLITE_OK else {
            throw SQLiteError.Bind(message: errorMessage)
        }
        
        guard sqlite3_step(deleteStatement) == SQLITE_DONE else {
            throw SQLiteError.Step(message: errorMessage)
        }
    }
    
    func delete(job: Job) throws{
        let querySql = "UPDATE job SET is_deleted = 1 WHERE id = ?;"
        guard let deleteStatement = try? prepareStatement(sql: querySql) else {
            throw SQLiteError.Prepare(message: errorMessage)
        }
        
        defer {
            sqlite3_finalize(deleteStatement)
        }
        
        guard sqlite3_bind_text(deleteStatement, 1, job.id.utf8String,-1,nil) == SQLITE_OK else {
            throw SQLiteError.Bind(message: errorMessage)
        }
        
        guard sqlite3_step(deleteStatement) == SQLITE_DONE else {
            throw SQLiteError.Step(message: errorMessage)
        }
    }
    func deleteJobsByWorkerName(workerName: NSString) throws{
        let querySql = "UPDATE job SET is_deleted = 1 WHERE worker_name = ?;"
        guard let deleteStatement = try? prepareStatement(sql: querySql) else {
            throw SQLiteError.Prepare(message: errorMessage)
        }
        
        defer {
            sqlite3_finalize(deleteStatement)
        }
        
        guard sqlite3_bind_text(deleteStatement, 1, workerName.utf8String,-1,nil) == SQLITE_OK else {
            throw SQLiteError.Bind(message: errorMessage)
        }
        
        guard sqlite3_step(deleteStatement) == SQLITE_DONE else {
            throw SQLiteError.Step(message: errorMessage)
        }
    }
    
    func update(job: Job) throws{
        let querySql = "UPDATE job SET active = ?, failed = ?, meta_data = ?, attempts = ?, status = ? WHERE id = ?;"
        guard let updateStatement = try? prepareStatement(sql: querySql) else {
            throw SQLiteError.Prepare(message: errorMessage)
        }
        
        defer {
            sqlite3_finalize(updateStatement)
        }
        
        guard (sqlite3_bind_int(updateStatement, 1,job.active) == SQLITE_OK &&
                    sqlite3_bind_text(updateStatement, 2, job.failed.utf8String, -1, nil) == SQLITE_OK &&
                    sqlite3_bind_text(updateStatement, 3, job.metaData.utf8String, -1, nil) == SQLITE_OK &&
                    sqlite3_bind_int(updateStatement, 4, job.attempts) == SQLITE_OK &&
                    sqlite3_bind_text(updateStatement, 5, job.status.utf8String, -1, nil) == SQLITE_OK &&
                    sqlite3_bind_text(updateStatement, 6, job.id.utf8String,-1, nil) == SQLITE_OK
                    ) else {
                        throw SQLiteError.Bind(message: errorMessage)
        }
        guard sqlite3_step(updateStatement) == SQLITE_DONE else {
            throw SQLiteError.Step(message: errorMessage)
        }
        
    }
    
    func mapColumnsToJob(sqlStatement: OpaquePointer?)->Job?{
        if(sqlStatement != nil){
            let idColumnContent = sqlite3_column_text(sqlStatement, 0)
            let id = String(cString: idColumnContent!) as NSString
            let workerNameColumnContent = sqlite3_column_text(sqlStatement, 1)
            let workerName = String(cString: workerNameColumnContent!) as NSString
            let active=sqlite3_column_int(sqlStatement, 2)
            let payloadColumnContent = sqlite3_column_text(sqlStatement, 3)
            let payload = String(cString: payloadColumnContent!) as NSString
            let metaDataColumnContent = sqlite3_column_text(sqlStatement, 4)
            let metaData = String(cString: metaDataColumnContent!) as NSString
            let attempts=sqlite3_column_int(sqlStatement, 5)
            let createdColumnContent = sqlite3_column_text(sqlStatement, 6)
            let created = String(cString: createdColumnContent!) as NSString
            let failedColumnContent = sqlite3_column_text(sqlStatement, 7)
            let failed = String(cString: failedColumnContent!) as NSString
            let timeout=sqlite3_column_int(sqlStatement, 8)
            let priority=sqlite3_column_int(sqlStatement, 9)
            let isDeleted = sqlite3_column_int(sqlStatement, 10)
            let statusColumnContent = sqlite3_column_text(sqlStatement, 11)
            let status = String(cString: statusColumnContent!) as NSString
            return Job(id: id, workerName: workerName,active:active,payload:payload,metaData: metaData,attempts: attempts,created: created,failed: failed,timeout: timeout,priority: priority, isDeleted: isDeleted, status: status)
        }else{
            return nil
        }
    }
}
