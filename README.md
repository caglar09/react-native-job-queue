# React Native Job Queue

This library is inspired by [react-native-queue](https://github.com/billmalarky/react-native-queue) which seems to be unmaintained.
Instead of using realm, this library provides an own sqlite based native implementation.

Since react-native struggles with using `use_frameworks!` in pod files i wasn't able to use https://github.com/stephencelis/SQLite.swift and had to implement the native ios part guided by https://www.raywenderlich.com/385-sqlite-with-swift-tutorial-getting-started . If react-native starts to support `use_frameworks!` or you are able to make it work, feel free to do a PR.
On Android i used Androids Room-Persitence-Library.

You can find API-Reference [here](https://simonerm.github.io/react-native-job-queue/docs/)

## Getting started (RN>=0.60)

`$ npm install react-native-job-queue --save`

### Install Pods

`$ cd ios && pod install`

A persistent, cross-platform job queue for React Native applications, enabling reliable background task processing on both Android and iOS.

## Features

-   **Cross-Platform**: Seamlessly works on Android and iOS using native implementations.
-   **Persistent Storage**: Jobs are saved to native device storage (SQLite on iOS, Room on Android) and persist across app restarts.
-   **Background Processing**: Define and execute tasks in the background, independent of the UI thread.
-   **Worker System**: Register custom worker functions to handle different types of jobs.
-   **Concurrency Control**: Configure the maximum number of jobs to run concurrently, both globally and per worker.
-   **Job Lifecycle Management**: Full control over jobs: add, start, stop, cancel, requeue, and remove.
-   **Retry Logic**: Automatically retry failed jobs with a configurable number of attempts.
-   **Timeouts**: Set timeouts for jobs to prevent them from running indefinitely.
-   **Prioritization**: Assign priorities to jobs to influence execution order.
-   **Event System**: Subscribe to events for job lifecycle updates (added, started, succeeded, failed, completed).
-   **React Hook (`useQueue`)**: Easily monitor and display queue status within your React components.

## Architecture Overview

The library consists of three main parts:

1. **JavaScript/TypeScript Layer**:  
   Provides the public API (`Queue`, `Worker`, `useQueue`) for interacting with the job queue from your React Native application. It manages workers, job creation, and communication with the native layer.

2. **Native Android Implementation (Java)**:  
   A native module using the Room Persistence Library to store and manage jobs in an SQLite database. It handles job fetching, updating, and deletion on Android devices.

3. **Native iOS Implementation (Swift/Objective-C)**:  
   A native module using SQLite directly to provide job persistence and management capabilities on iOS devices.

The JavaScript layer communicates with the appropriate native module via the React Native bridge to ensure jobs are stored reliably and processed efficiently in the background.

## Installation

```bash
# Using npm
npm install <package-name> --save

# Using yarn
yarn add <package-name>

# Link native modules
react-native link <package-name>

# Install pods for iOS
cd ios && pod install
```

> **Note**: Replace `<package-name>` with the actual name of your package once published.

## Basic Usage

### 1. Configure the Queue (Optional)

```typescript
import queue from '<package-name>';

queue.configure({
    onQueueFinish: (executedJobs) => {
        console.log('Queue finished processing:', executedJobs);
    },
    updateInterval: 15,
    concurrency: 5,
});
```

### 2. Define a Worker

```typescript
import { Worker } from '<package-name>';

interface MyJobPayload {
    userId: string;
    data: any;
    delay?: number;
}

const myWorker = new Worker<MyJobPayload>(
    'my-task-worker',
    async (payload, jobId) => {
        console.log(`Running job ${jobId} for user ${payload.userId}`);
        await new Promise((resolve) => setTimeout(resolve, payload.delay || 1000));
        console.log(`Job ${jobId} completed successfully.`);
    },
    {
        concurrency: 3,
        onStart: (job) => console.log(`Job ${job.id} started.`),
        onSuccess: (job) => console.log(`Job ${job.id} succeeded.`),
        onFailure: (job, error) => console.log(`Job ${job.id} failed:`, error.message),
        onCompletion: (job) => console.log(`Job ${job.id} completed.`),
    }
);

queue.addWorker(myWorker);
```

### 3. Add a Job

```typescript
const jobPayload: MyJobPayload = {
    userId: 'user-123',
    data: { message: 'Process this data' },
    delay: 2000,
};

const jobId = queue.addJob('my-task-worker', jobPayload, {
    attempts: 3,
    timeout: 10000,
    priority: 1,
});

console.log(`Added job with ID: ${jobId}`);

// queue.start();
```

### 4. Monitor Queue State (using `useQueue` hook)

```typescript
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useQueue } from '<package-name>';

function QueueStatusDisplay() {
    const { queuedCount, activeCount, failedCount, completedCount, activeJobs, lastCompletedJobs, refreshJobs } =
        useQueue();

    return (
        <View>
            <Text>Queued: {queuedCount}</Text>
            <Text>Active: {activeCount}</Text>
            <Text>Failed: {failedCount}</Text>
            <Text>Completed: {completedCount}</Text>
            <Button title="Refresh Jobs" onPress={refreshJobs} />
        </View>
    );
}

export default QueueStatusDisplay;
```

## API Reference

### Queue (Singleton Instance)

-   `Queue.instance`
-   `configure(options: QueueOptions)`
-   `addWorker(worker: Worker<any>)`
-   `removeWorker(name: string, deleteRelatedJobs?: boolean)`
-   `addJob<P extends object>(workerName: string, payload: P, options?: JobOptions, startQueue?: boolean)`
-   `start()`
-   `stop()`
-   `getJobs()`
-   `getJobsWithDeleted()`
-   `removeJob(job: RawJob)`
-   `removeJobPermanent(job: RawJob)`
-   `requeueJob(job: RawJob)`
-   `cancelJob(jobId: string, error?: Error)`
-   `on(event: QueueEvent, listener: Function)`
-   `off(event: QueueEvent, listener: Function)`
-   `isRunning: boolean`
-   `registeredWorkers: { [key: string]: Worker<any> }`

### Worker<P extends object>

-   `constructor(name: string, executer: Function, options?: WorkerOptions<P>)`
-   `name: string`
-   `concurrency: number`
-   `isBusy: boolean`
-   `availableExecuters: number`

### useQueue() Hook

Returns:

-   `queuedCount: number`
-   `activeCount: number`
-   `failedCount: number`
-   `completedCount: number`
-   `activeJobs: RawJob[]`
-   `lastCompletedJobs: RawJob[]`
-   `refreshJobs: () => void`

## Job Options

-   `attempts: number`
-   `timeout: number`
-   `priority: number`

## Queue Events

-   `workerAdded: (workerName: string)`
-   `jobAdded: (job: RawJob)`
-   `jobStarted: (job: RawJob)`
-   `jobSucceeded: (job: RawJob)`
-   `jobFailed: (job: RawJob, error: Error)`
-   `jobCompleted: (job: RawJob)`

## Native Configuration

-   **Android**: No specific configuration usually needed.
-   **iOS**: Enable Background Modes if necessary.

## Contributing

(Add contribution guidelines if applicable.)

## License

(Specify the license, e.g., MIT.)

---

## Table of Contents

-   [React Native Job Queue](#react-native-job-queue)
-   [Features](#features)
-   [Architecture Overview](#architecture-overview)
-   [Installation](#installation)
-   [Basic Usage](#basic-usage)
-   [API Reference](#api-reference)
-   [Job Options](#job-options)
-   [Queue Events](#queue-events)
-   [Native Configuration](#native-configuration)
-   [Contributing](#contributing)
-   [License](#license)
