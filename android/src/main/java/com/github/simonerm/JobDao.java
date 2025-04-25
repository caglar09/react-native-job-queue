package com.github.simonerm;

import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.Query;
import androidx.room.Update;

import java.util.List;

@Dao
public interface JobDao {
    @Query("SELECT * FROM job WHERE is_deleted == 0")
    List<Job> getAll();

    @Query("SELECT * FROM job WHERE active == 0 AND failed == '' AND is_deleted == 0 ORDER BY priority DESC,datetime(created) LIMIT 1")
    Job getNextJob();

    @Query("SELECT * FROM job WHERE is_deleted == 0 ORDER BY priority DESC,datetime(created)")
    List<Job> getJobs();
  
    @Query("SELECT * FROM job ORDER BY priority DESC,datetime(created)")
    List<Job> getJobsWithDeleted();

    @Query("SELECT * FROM job WHERE active == 1 AND is_deleted == 0")
    List<Job> getActiveMarkedJobs();

    @Query("SELECT * FROM job WHERE active == 0 AND failed == '' AND worker_name == :workerName AND is_deleted == 0 ORDER BY priority DESC,datetime(created) LIMIT :limit")
    List<Job> getJobsForWorker(String workerName, int limit);
   
    @Query("SELECT * FROM job WHERE active == 0 AND failed == '' AND worker_name == :workerName ORDER BY priority DESC,datetime(created) LIMIT :limit")
    List<Job> getJobsForWorkerWithDeleted(String workerName, int limit);

    @Query("SELECT * FROM job WHERE id LIKE :id AND is_deleted == 0")
    Job findById(String id);

    @Query("SELECT COUNT(*) from job WHERE is_deleted == 0")
    int countJobs();

    @Update
    void update(Job job);

    @Insert
    void insert(Job job);

    @Delete
    void delete(Job job);

    @Query("UPDATE job SET is_deleted = 1 WHERE worker_name == :workerName")
    void markJobsAsDeletedByWorkerName(String workerName);

    @Query("UPDATE job SET is_deleted = 1 WHERE id = :jobId")
    void softDeleteJob(String jobId);
}
